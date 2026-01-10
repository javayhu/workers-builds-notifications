/**
 * Cloudflare Workers Builds → Multi-Platform Notifications
 *
 * This worker consumes build events from a Cloudflare Queue and sends
 * notifications to Slack, Lark, Discord, or any combination of these platforms:
 * - Preview/Live URLs for successful builds
 * - Error messages for failed builds
 * - Cancellation notices for cancelled builds
 *
 * @see https://developers.cloudflare.com/workers/ci-cd/builds
 * @see https://developers.cloudflare.com/queues/
 * @see https://developers.cloudflare.com/queues/event-subscriptions/
 */

import type { Env, CloudflareEvent } from "./types";
import { getBuildStatus } from "./helpers";
import { fetchBuildUrls, fetchBuildLogs } from "./api";
import { sendNotifications } from "./notificationManager";

export default {
	async queue(batch: MessageBatch<CloudflareEvent>, env: Env): Promise<void> {
		// Check if at least one webhook is configured
		const hasWebhook =
			env.SLACK_WEBHOOK_URL || env.LARK_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;

		if (!hasWebhook) {
			console.error(
				"No webhook URLs configured. Set SLACK_WEBHOOK_URL, LARK_WEBHOOK_URL, or DISCORD_WEBHOOK_URL.",
			);
			for (const message of batch.messages) {
				message.ack();
			}
			return;
		}

		for (const message of batch.messages) {
			try {
				const event = message.body;

				// Validate event structure
				if (!event?.type || !event?.payload || !event?.metadata) {
					console.error("Invalid event structure:", JSON.stringify(event));
					message.ack();
					continue;
				}

				// Skip started/queued events - no notification needed
				if (event.type.includes("started") || event.type.includes("queued")) {
					message.ack();
					continue;
				}

				const status = getBuildStatus(event);

				// Fetch additional data based on build status
				let previewUrl: string | null = null;
				let liveUrl: string | null = null;
				let logs: string[] = [];

				if (status.isSucceeded) {
					({ previewUrl, liveUrl } = await fetchBuildUrls(event, env));
				} else if (status.isFailed && !status.isCancelled) {
					logs = await fetchBuildLogs(event, env);
				}

				// Send notifications to all configured platforms
				await sendNotifications({ event, previewUrl, liveUrl, logs }, env);

				message.ack();
			} catch (error) {
				console.error("Error processing message:", error);
				message.ack();
			}
		}
	},
} satisfies ExportedHandler<Env, CloudflareEvent>;
