import { Session } from "@shopify/shopify-api";
import prisma from "./db.server";

class D1PrismaSessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    const params = session.toObject();
    const user = params.onlineAccessInfo?.associated_user;

    const data = {
      id: session.id,
      shop: session.shop,
      state: session.state,
      isOnline: session.isOnline,
      scope: session.scope ?? null,
      expires: session.expires ?? null,
      accessToken: session.accessToken ?? "",
      userId: user?.id != null ? BigInt(String(user.id)) : null,
      firstName: user?.first_name ?? null,
      lastName: user?.last_name ?? null,
      email: user?.email ?? null,
      accountOwner: user?.account_owner ?? false,
      locale: user?.locale ?? null,
      collaborator: user?.collaborator ?? false,
      emailVerified: user?.email_verified ?? false,
      refreshToken: params.refreshToken ?? null,
      refreshTokenExpires: params.refreshTokenExpires ?? null,
    };

    await prisma.session.upsert({
      where: { id: session.id },
      update: data,
      create: data,
    });

    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const row = await prisma.session.findUnique({
      where: { id },
    });

    if (!row) {
      return undefined;
    }

    return this.rowToSession(row);
  }

  async deleteSession(id: string): Promise<boolean> {
    await prisma.session.deleteMany({
      where: { id },
    });

    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    await prisma.session.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const rows = await prisma.session.findMany({
      where: { shop },
      take: 25,
      orderBy: [{ expires: "desc" }],
    });

    return rows.map((row) => this.rowToSession(row));
  }

  private rowToSession(row: {
    id: string;
    shop: string;
    state: string;
    isOnline: boolean;
    scope: string | null;
    expires: Date | null;
    accessToken: string;
    userId: bigint | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    accountOwner: boolean;
    locale: string | null;
    collaborator: boolean | null;
    emailVerified: boolean | null;
    refreshToken: string | null;
    refreshTokenExpires: Date | null;
  }): Session {
    const values: Array<[string, string | number | boolean]> = [
      ["id", row.id],
      ["shop", row.shop],
      ["state", row.state],
      ["isOnline", row.isOnline],
    ];

    if (row.scope) values.push(["scope", row.scope]);
    if (row.expires) values.push(["expires", row.expires.getTime()]);
    if (row.accessToken) values.push(["accessToken", row.accessToken]);
    if (row.userId !== null) values.push(["userId", row.userId.toString()]);
    if (row.firstName) values.push(["firstName", row.firstName]);
    if (row.lastName) values.push(["lastName", row.lastName]);
    if (row.email) values.push(["email", row.email]);

    values.push(["accountOwner", row.accountOwner]);

    if (row.locale) values.push(["locale", row.locale]);
    if (row.collaborator !== null) {
      values.push(["collaborator", row.collaborator]);
    }
    if (row.emailVerified !== null) {
      values.push(["emailVerified", row.emailVerified]);
    }
    if (row.refreshToken) {
      values.push(["refreshToken", row.refreshToken]);
    }
    if (row.refreshTokenExpires) {
      values.push(["refreshTokenExpires", row.refreshTokenExpires.getTime()]);
    }

    return Session.fromPropertyArray(values, true);
  }
}

const sessionStorage = new D1PrismaSessionStorage();

export default sessionStorage;
