const { z } = require("zod");

const text = (label, min = 2) =>
  z.string().trim().min(min, `${label} must be at least ${min} characters`);

const coordinate = (label, min, max) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .transform(Number)
    .pipe(
      z
        .number()
        .min(min, `${label} must be between ${min} and ${max}`)
        .max(max, `${label} must be between ${min} and ${max}`),
    );

const createPropertySchema = z.object({
  name: text("Name"),
  address: text("Address", 5),
  pin: z.string().trim().regex(/^\d{6}$/, "PIN must be 6 digits"),
  city: text("City"),
  state: text("State"),
  location: text("Location"),
  lat: coordinate("Latitude", -90, 90),
  long: coordinate("Longitude", -180, 180),
});

const updatePropertySchema = createPropertySchema.partial();

module.exports = { createPropertySchema, updatePropertySchema };