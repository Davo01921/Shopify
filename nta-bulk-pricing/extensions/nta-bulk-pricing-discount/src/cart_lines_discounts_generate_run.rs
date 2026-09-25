use super::schema;
use shopify_function::prelude::*;
use shopify_function::Result;

#[derive(Deserialize, Default, PartialEq)]
#[shopify_function(rename_all = "camelCase")]
pub struct Configuration {
    pub rules: Vec<Rule>,
}

#[derive(Deserialize, Default, PartialEq)]
#[shopify_function(rename_all = "camelCase")]
pub struct Rule {
    pub id: String,
    pub title: Option<String>,
    pub enabled: Option<bool>,
    pub priority: Option<i32>,
    pub target: Target,
    pub tiers: Vec<Tier>,
}

#[derive(Deserialize, Default, PartialEq)]
#[shopify_function(rename_all = "camelCase")]
pub struct Target {
    #[shopify_function(rename = "type")]
    pub r#type: String,
    pub ids: Vec<String>,
}

#[derive(Deserialize, Default, PartialEq)]
#[shopify_function(rename_all = "camelCase")]
pub struct Tier {
    pub id: String,
    pub min: i32,
    pub max: Option<i32>,
    pub message: Option<String>,
    pub discount: DiscountValue,
}

#[derive(Deserialize, Default, PartialEq)]
#[shopify_function(rename_all = "camelCase")]
pub struct DiscountValue {
    #[shopify_function(rename = "type")]
    pub r#type: String,
    pub value: Option<f64>,
}

fn target_weight(target_type: &str) -> i32 {
    match target_type {
        "VARIANTS" => 400,
        "PRODUCT" => 300,
        "PRODUCTS" => 200,
        "COLLECTIONS" => 100,
        _ => 0,
    }
}

fn rule_matches(
    rule: &Rule,
    variant_id: &str,
    product_id: &str,
    collection_ids: &[String],
) -> bool {
    match rule.target.r#type.as_str() {
        "VARIANTS" => rule.target.ids.iter().any(|id| id == variant_id),
        "PRODUCT" => {
            rule.target.ids.len() == 1 && rule.target.ids[0].as_str() == product_id
        }
        "PRODUCTS" => rule.target.ids.iter().any(|id| id == product_id),
        "COLLECTIONS" => rule
            .target
            .ids
            .iter()
            .any(|id| collection_ids.iter().any(|collection_id| collection_id == id)),
        _ => false,
    }
}

fn select_rule<'a>(
    rules: &'a [Rule],
    variant_id: &str,
    product_id: &str,
    collection_ids: &[String],
) -> Option<&'a Rule> {
    let mut best: Option<(&Rule, i32)> = None;

    for rule in rules {
        if rule.enabled == Some(false)
            || !rule_matches(rule, variant_id, product_id, collection_ids)
        {
            continue;
        }

        let score = target_weight(&rule.target.r#type) + rule.priority.unwrap_or(0);
        if best.map(|(_, best_score)| score > best_score).unwrap_or(true) {
            best = Some((rule, score));
        }
    }

    best.map(|(rule, _)| rule)
}

fn select_tier(rule: &Rule, quantity: i32) -> Option<&Tier> {
    rule.tiers
        .iter()
        .filter(|tier| quantity >= tier.min && tier.max.map(|max| quantity <= max).unwrap_or(true))
        .max_by_key(|tier| tier.min)
}

#[shopify_function]
fn cart_lines_discounts_generate_run(
    input: schema::cart_lines_discounts_generate_run::Input,
) -> Result<schema::CartLinesDiscountsGenerateRunResult> {
    let has_product_discount_class = input
        .discount()
        .discount_classes()
        .contains(&schema::DiscountClass::Product);

    if !has_product_discount_class {
        return Ok(schema::CartLinesDiscountsGenerateRunResult { operations: vec![] });
    }

    let configuration = match input.discount().metafield() {
        Some(metafield) => metafield.json_value(),
        None => return Ok(schema::CartLinesDiscountsGenerateRunResult { operations: vec![] }),
    };

    let mut candidates = vec![];

    for line in input.cart().lines() {
        let variant = match line.merchandise() {
            schema::cart_lines_discounts_generate_run::input::cart::lines::Merchandise::ProductVariant(variant) => variant,
            _ => continue,
        };

        let product = variant.product();
        let collection_ids: Vec<String> = product
            .collection_memberships()
            .iter()
            .filter(|membership| *membership.is_member())
            .map(|membership| membership.collection_id().clone())
            .collect();

        let rule = match select_rule(
            &configuration.rules,
            variant.id(),
            product.id(),
            &collection_ids,
        ) {
            Some(rule) => rule,
            None => continue,
        };

        let tier = match select_tier(rule, *line.quantity()) {
            Some(tier) if tier.discount.r#type != "NONE" => tier,
            _ => continue,
        };

        let value = match (tier.discount.r#type.as_str(), tier.discount.value) {
            ("PERCENTAGE", Some(value)) if (0.0..=100.0).contains(&value) => {
                schema::ProductDiscountCandidateValue::Percentage(schema::Percentage {
                    value: Decimal(value),
                })
            }
            ("FIXED_PER_ITEM", Some(value)) if value >= 0.0 => {
                schema::ProductDiscountCandidateValue::FixedAmount(
                    schema::ProductDiscountCandidateFixedAmount {
                        amount: Decimal(value),
                        applies_to_each_item: Some(true),
                    },
                )
            }
            _ => continue,
        };

        let message = tier
            .message
            .clone()
            .or_else(|| rule.title.clone())
            .filter(|value| !value.is_empty());

        candidates.push(schema::ProductDiscountCandidate {
            targets: vec![schema::ProductDiscountCandidateTarget::CartLine(
                schema::CartLineTarget {
                    id: line.id().clone(),
                    quantity: None,
                },
            )],
            message,
            value,
            associated_discount_code: None,
            prerequisites: None,
        });
    }

    if candidates.is_empty() {
        return Ok(schema::CartLinesDiscountsGenerateRunResult { operations: vec![] });
    }

    Ok(schema::CartLinesDiscountsGenerateRunResult {
        operations: vec![schema::CartOperation::ProductDiscountsAdd(
            schema::ProductDiscountsAddOperation {
                candidates,
                selection_strategy: schema::ProductDiscountSelectionStrategy::All,
            },
        )],
    })
}
