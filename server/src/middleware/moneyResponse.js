import { toClientJson } from "../utils/money.js";

// Converts paise fields to rupees in every JSON response. An endpoint that
// formats money itself sets `res.locals.rawMoney = true` to opt out.
export function moneyResponse(req, res, next) {
  const original = res.json.bind(res);
  res.json = (body) => {
    if (res.locals.rawMoney || body === null || typeof body !== "object") {
      return original(body);
    }
    return original(toClientJson(body));
  };
  next();
}