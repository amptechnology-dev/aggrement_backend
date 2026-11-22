const { z } = require("zod");

const num = (label, min, max, int = false) => {
  let s = z.coerce
    .number()
    .min(min, `${label} must be between ${min} and ${max}`)
    .max(max, `${label} must be between ${min} and ${max}`);
  if (int) s = s.int(`${label} must be a whole number`);
  return s;
};

// settings ও agreement দুই জায়গায় একই rule
const ruleFields = {
  lateFineAmountPerDay: num("Late fine per day", 0, 100000).optional(),
  lateFineAfterDay: num("Late fine start day", 1, 28, true).optional(),
  rentIncreaseEveryYears: num("Rent increase interval", 0, 50, true).optional(),
  rentIncreasePercent: num("Rent increase percent", 0, 100).optional(),
  validityYears: num("Validity", 1, 99, true).optional(),
  stallCannotCloseForDays: num("Stall closing limit", 0, 365, true).optional(),
  noticePeriodMonths: num("Notice period", 0, 24, true).optional(),
};

const termText = z
  .string()
  .trim()
  .min(5, "A term must be at least 5 characters")
  .max(1000, "A term can be at most 1000 characters");

const updateSettingsSchema = z.object({
  officeName: z.string().trim().max(150, "Office name is too long").optional(),
  officeAddress: z.string().trim().max(300, "Office address is too long").optional(),
  ...ruleFields,
});

const termSchema = z.object({ text: termText });

module.exports = { ruleFields, termText, updateSettingsSchema, termSchema };