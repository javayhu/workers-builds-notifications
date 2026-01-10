/**
 * Slack notifier using Block Kit message formatting.
 */

import type {
	SectionBlock,
	ContextBlock,
	KnownBlock,
	MrkdwnElement,
	Button,
} from "@slack/types";

import type { CloudflareEvent } from "../types";
import type { Notifier, NotificationData } from "./base";
import {
	getBuildStatus,
	isProductionBranch,
	extractAuthorName,
	getCommitUrl,
	getDashboardUrl,
	extractBuildError,
} from "../helpers";

// =============================================================================
// TYPES
// =============================================================================

export interface SlackPayload {
	blocks: KnownBlock[];
}

// =============================================================================
// BLOCK BUILDERS
// =============================================================================

/**
 * Builds a section block with optional button accessory.
 */
function buildSectionBlock(
	text: string,
	buttonText?: string,
	buttonUrl?: string | null,
	buttonStyle?: Button["style"],
): SectionBlock {
	const block: SectionBlock = {
		type: "section",
		text: { type: "mrkdwn", text },
	};

	if (buttonText && buttonUrl) {
		block.accessory = {
			type: "button",
			text: { type: "plain_text", text: buttonText },
			url: buttonUrl,
			...(buttonStyle && { style: buttonStyle }),
		};
	}

	return block;
}

/**
 * Builds a context block from mrkdwn elements.
 */
function buildContextBlock(elements: MrkdwnElement[]): ContextBlock {
	return { type: "context", elements };
}

/**
 * Builds context elements (branch, commit, author) from event metadata.
 */
function buildContextElements(event: CloudflareEvent): MrkdwnElement[] {
	const meta = event.payload?.buildTriggerMetadata;
	const commitUrl = getCommitUrl(event);
	const elements: MrkdwnElement[] = [];

	if (meta?.branch) {
		elements.push({
			type: "mrkdwn",
			text: `*Branch:* \`${meta.branch}\``,
		});
	}

	if (meta?.commitHash) {
		const commitText = meta.commitHash.substring(0, 7);
		elements.push({
			type: "mrkdwn",
			text: `*Commit:* ${commitUrl ? `<${commitUrl}|${commitText}>` : `\`${commitText}\``}`,
		});
	}

	const authorName = extractAuthorName(meta?.author);
	if (authorName) {
		elements.push({ type: "mrkdwn", text: `*Author:* ${authorName}` });
	}

	return elements;
}

// =============================================================================
// MESSAGE BUILDERS
// =============================================================================

function buildSuccessMessage(
	event: CloudflareEvent,
	isProduction: boolean,
	previewUrl: string | null,
	liveUrl: string | null,
): SlackPayload {
	const workerName = event.source?.workerName || "Worker";
	const dashUrl = getDashboardUrl(event);

	const title = isProduction ? "Production Deploy" : "Preview Deploy";
	const buttonText = isProduction
		? liveUrl
			? "View Worker"
			: "View Build"
		: previewUrl
			? "View Preview"
			: "View Build";
	const buttonUrl = isProduction ? liveUrl || dashUrl : previewUrl || dashUrl;

	const blocks: KnownBlock[] = [
		buildSectionBlock(`✅  *${title}*\n*${workerName}*`, buttonText, buttonUrl),
	];

	const contextElements = buildContextElements(event);
	if (contextElements.length > 0) {
		blocks.push(buildContextBlock(contextElements));
	}

	return { blocks };
}

function buildFailureMessage(
	event: CloudflareEvent,
	logs: string[],
): SlackPayload {
	const workerName = event.source?.workerName || "Worker";
	const dashUrl = getDashboardUrl(event);
	const error = extractBuildError(logs);

	const blocks: KnownBlock[] = [
		buildSectionBlock(
			`❌  *Build Failed*\n*${workerName}*`,
			dashUrl ? "View Logs" : undefined,
			dashUrl,
			"danger",
		),
	];

	const contextElements = buildContextElements(event);
	if (contextElements.length > 0) {
		blocks.push(buildContextBlock(contextElements));
	}

	// Error message in code block
	blocks.push({
		type: "section",
		text: { type: "mrkdwn", text: `\`\`\`${error}\`\`\`` },
	});

	return { blocks };
}

function buildCancelledMessage(event: CloudflareEvent): SlackPayload {
	const workerName = event.source?.workerName || "Worker";
	const dashUrl = getDashboardUrl(event);

	const blocks: KnownBlock[] = [
		buildSectionBlock(
			`⚠️  *Build Cancelled*\n*${workerName}*`,
			dashUrl ? "View Build" : undefined,
			dashUrl,
		),
	];

	const contextElements = buildContextElements(event);
	if (contextElements.length > 0) {
		blocks.push(buildContextBlock(contextElements));
	}

	return { blocks };
}

function buildFallbackMessage(event: CloudflareEvent): SlackPayload {
	return {
		blocks: [
			{
				type: "section",
				text: { type: "mrkdwn", text: `📢 ${event.type || "Unknown event"}` },
			},
		],
	};
}

// =============================================================================
// NOTIFIER IMPLEMENTATION
// =============================================================================

export class SlackNotifier implements Notifier {
	readonly name = "Slack";

	buildPayload(data: NotificationData): SlackPayload {
		const { event, previewUrl, liveUrl, logs } = data;
		const status = getBuildStatus(event);
		const meta = event.payload?.buildTriggerMetadata;
		const isProduction = isProductionBranch(meta?.branch);

		if (status.isSucceeded) {
			return buildSuccessMessage(event, isProduction, previewUrl, liveUrl);
		}

		if (status.isFailed) {
			return buildFailureMessage(event, logs);
		}

		if (status.isCancelled) {
			return buildCancelledMessage(event);
		}

		return buildFallbackMessage(event);
	}

	async send(webhookUrl: string, payload: SlackPayload): Promise<void> {
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			throw new Error(
				`Slack API error: ${response.status} ${await response.text()}`,
			);
		}
	}
}
