import "https://deno.land/std@0.224.0/dotenv/load.ts";
Deno.test("env probe", () => {
  const keys = Object.keys(Deno.env.toObject()).filter(k =>
    /SUPABASE|BROWSERLESS|VITE_/i.test(k)
  );
  console.log("Available keys:", keys);
});
