import app from "./app";
import { env } from "./env";

app.listen(env.PORT, () => {
  console.log(`ShopVerse API running at http://localhost:${env.PORT}`);
  console.log(`Health check: http://localhost:${env.PORT}/health`);
});