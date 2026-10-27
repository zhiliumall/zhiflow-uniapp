/*
 * Copyright (C) 2026 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 下单防重 token：结算页取号、提交带头、失效换新。
 *
 * 后端语义（CheckoutTokenController / OrderInfoController#orderAddMap）：
 * - 发放：GET /mallapi/checkout/token → { token, expiresIn: 1800, header: "X-Checkout-Token" }，绑定当前用户，30 分钟有效
 * - 提交：POST /mallapi/orderinfo/map，请求头 X-Checkout-Token
 *   - 同一 token 还在处理 → HTTP 409「订单正在提交」
 *   - 同一 token 已成功 → 原样返回原订单，不会建第二张单
 *   - 下单失败 → 后端把 token 恢复成可用，同一 token 可直接重试
 *   - token 不存在 / 过期 / 不是本人 → 后端开了强制校验时回 HTTP 400「结算页已过期」
 *
 * 前端做法：
 * - 进结算页取一枚；取不到不拦下单
 * - 网络超时 / 5xx / 409 后再点提交，沿用同一枚——后端若其实已经建单，会把原订单还回来
 * - 只有后端明确回 HTTP 400 时才换一枚新的，并自动重提一次
 * - 一单结束后丢掉旧 token
 */

export const CHECKOUT_TOKEN_HEADER = "X-Checkout-Token";

/** 后端判 token 失效时回的 HTTP 状态码 */
export const CHECKOUT_TOKEN_REJECTED_STATUS = 400;

/** api/createRequestClient 对 HTTP 非 200 的 reject 结构：{ type: "SERVER_ERROR", code: <HTTP 状态码>, message } */
const HTTP_ERROR_TYPE = "SERVER_ERROR";

export interface CheckoutTokenHolder {
  /** 立刻换一枚新 token（进结算页时调）；取不到返回 "" 且不抛错 */
  refresh(): Promise<string>;
  /** 丢掉当前 token，下次提交前再取（一单结束后调） */
  invalidate(): void;
  /** 当前 token（可能为空串） */
  current(): string;
  /**
   * 带 token 提交。submit 用传入的 token 发请求；
   * 后端回 HTTP 400（token 失效）时换新 token 自动重提交一次，其余失败原样抛出。
   */
  submit<T>(submit: (token: string) => Promise<T>): Promise<T>;
}

/** 请求层 reject 出来的错误是否为「token 失效」：只认 HTTP 400，不认 409（处理中）与业务码 */
export function isCheckoutTokenRejected(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const e = err as { type?: unknown; code?: unknown };
  return e.type === HTTP_ERROR_TYPE && e.code === CHECKOUT_TOKEN_REJECTED_STATUS;
}

/** 从取号接口的响应里拿 token：{ data: { token } }，拿不到返回 "" */
export function tokenFromResponse(res: unknown): string {
  const token = (res as { data?: { token?: unknown } } | null | undefined)?.data?.token;
  return typeof token === "string" ? token.trim() : "";
}

/**
 * @param fetchToken 取 token 的接口调用；返回 token 字符串（取不到可返回空串或 reject，都按「没有 token」处理）
 */
export function createCheckoutTokenHolder(
  fetchToken: () => Promise<string | null | undefined>
): CheckoutTokenHolder {
  let token = "";
  let inflight: Promise<string> | null = null;

  const fetchNew = (): Promise<string> => {
    if (inflight) {
      return inflight;
    }
    inflight = Promise.resolve()
      .then(() => fetchToken())
      .then((t) => (typeof t === "string" ? t.trim() : ""))
      .catch(() => "")
      .then((t) => {
        token = t;
        inflight = null;
        return t;
      });
    return inflight;
  };

  return {
    refresh: fetchNew,
    invalidate() {
      token = "";
    },
    current() {
      return token;
    },
    async submit(submit) {
      // 进页时那一枚可能还在路上，或者上一单结束已丢掉：先等 / 先取
      const first = inflight ? await inflight : token || (await fetchNew());
      try {
        return await submit(first);
      } catch (err) {
        if (!isCheckoutTokenRejected(err)) {
          throw err;
        }
        // token 失效（过期 / 换了账号 / 被别处用掉）：换一枚新的，只重提交一次
        const second = await fetchNew();
        return submit(second);
      }
    },
  };
}
