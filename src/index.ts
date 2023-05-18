import env from "dotenv";
env.config();
import puppeteer, { Browser } from "puppeteer";
import { Twitter } from "./twitter";
import Fastify from "fastify";
import { DetailValue, HeadlessType } from "./types";

export const {
  PORT = "3000",
  HEADLESS = "new",
  HOST = "0.0.0.0",
  TIMEOUT = "30000",
} = process.env as {
  PORT: string;
  HEADLESS: HeadlessType;
  HOST: string;
  TIMEOUT: string;
};
const fastify = Fastify({
  logger: true,
});

let browser: Browser;

const tweetsSchema = {
  schema: {
    querystring: {
      type: "object",
      properties: {
        limit: { type: "number", default: 10 },
        details: {
          type: "string",
          enum: ["full", "simple"],
          default: "simple",
        },
      },
    },
  },
};

// Declare a route
fastify.get(
  "/twitter/tweets/:user",
  tweetsSchema,
  async function (request, reply) {
    const { user } = request.params as { user: string };
    const { limit, details } = request.query as {
      limit: number;
      details: DetailValue;
    };
    const bot = new Twitter(browser, user);
    let tweets = await bot.tweets();
    if (!tweets) return reply.send("No tweets found").code(404);
    fastify.log.info(
      { user },
      `Num pages: ${await browser.pages().then((pages) => pages.length)}`
    );
    if (limit) tweets = tweets.slice(0, limit);
    if (details === "simple") {
      reply.send(
        tweets.map((tweet) => {
          const media =
            tweet.content?.itemContent?.tweet_results.result.legacy.entities.media?.find(
              (item) => item.type === "photo"
            );
          return {
            full_text:
              tweet.content?.itemContent?.tweet_results.result.legacy.full_text
                .split("\n")
                .join(" "),
            url: media?.url,
          };
        })
      );
    } else reply.send(tweets);
  }
);

async function main() {
  browser = await puppeteer.launch({
    headless: HEADLESS,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  fastify.listen({ port: parseInt(PORT), host: HOST }).catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
}
main();
