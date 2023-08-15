const axios = require('axios');
const moment = require('moment');

async function fetchCommentsWithReplies(videoId) {
    const context = {
        client: {clientName: 'WEB', clientVersion: '2.9999099'}
    };

    const data = {
        context,
        videoId
    };

// Get video primary info
    try {
        // Fetch initial comments and extract the continuation token
        const initialResponse = await axios.post(
            'https://www.youtube.com/youtubei/v1/next',
            data
        );

        let token = extractContinuationToken(initialResponse);

        const contextInfo_ = await contextInfo(data, initialResponse);

        // Fetch and navigate through comment pages using the continuation token
        const commentRenderers = [];
        //let iter = 0;
        while (token) { //todo:test [&& iter <= 3]
            //   iter++;
            const response = await axios.post(
                'https://www.youtube.com/youtubei/v1/next',
                {...data, continuation: token}
            );

            const continuationItems = extractContinuationItems(response);

            for (const item of continuationItems) {
                if (item.commentThreadRenderer) {
                    const commentObj = item.commentThreadRenderer;
                    const replies = await collectReplies(commentObj, data);
                    commentObj.comment = cleanObj(commentObj.comment.commentRenderer);
                    commentObj.comment.replies = replies;

                    removeProperties(
                        commentObj,
                        'replies', 'trackingParams', 'renderingPriority', 'loggingDirectives'
                    );

                    commentRenderers.push(commentObj);
                }
            }

            token = extractNextPageToken(continuationItems);
        }
        contextInfo_.threads = commentRenderers
        return contextInfo_;
    } catch (error) {
        console.error('Error fetching comments:', error);
        return [];
    }
}

function removeProperties(object, ...properties) {
    for (const property of properties) {
        if (object.hasOwnProperty(property)) {
            delete object[property];
        }
    }
}

function extractRelativeTime(relativeTimeText) {
    const regex = /(?:(?<start>today|yesterday|now)|(?<time>\d+)\s*(?<unit>sec(?:ond)?|s|min(?:ute)?|h(?:our|r)?|d(?:ay)?|w(?:eek|k)?|mo(?:nth)?|y(?:ear|r)?)s?\s*ago)/;
    const match = relativeTimeText.match(regex);

    if (match) {
        const {start, time, unit} = match.groups;

        if (start) {
            return moment().startOf('day');
        }

        try {
            const unitMapping = {
                sec: 'seconds',
                s: 'seconds',
                min: 'minutes',
                minute: 'minutes',
                h: 'hours',
                hour: 'hours',
                r: 'hours', // for 'hour' or 'r' (singular form)
                d: 'days',
                day: 'days',
                w: 'weeks',
                week: 'weeks',
                k: 'weeks', // for 'week' or 'k' (singular form)
                mo: 'months',
                month: 'months',
                y: 'years',
                year: 'years',
                r: 'years', // for 'year' or 'r' (singular form)
            };

            const durationUnit = unitMapping[unit];
            if (durationUnit && time) {
                const duration = moment.duration(-time, durationUnit);
                return moment().add(duration);
            }
        } catch (error) {
            return null;
        }
    }

    return null;
}

function cleanObj(renderedObj) {

    const publishedTimeText_ = renderedObj.publishedTimeText?.runs[0]?.text || '';
    const label = renderedObj.actionButtons.commentActionButtonsRenderer.likeButton?.toggleButtonRenderer
        .accessibilityData?.accessibilityData?.label || '';
    const matches = label.match(/\d+/g); // Match all sequences of digits
    const numFormatted = matches ? parseInt(matches.join(''), 10) : 0;
    const likes = renderedObj.voteCount?.simpleText || '';
    const dateFormatted_ = extractRelativeTime(publishedTimeText_) || null;

    renderedObj.authorID = renderedObj.authorText.simpleText;
    renderedObj.authorBaseURL = renderedObj.authorEndpoint.browseEndpoint.canonicalBaseUrl;

    renderedObj.highlightLink = renderedObj.publishedTimeText?.runs?.[0]?.navigationEndpoint?.commandMetadata
        ?.webCommandMetadata?.url || '';

    renderedObj.publishedTimeText = {
        elapsedTimeText: publishedTimeText_,
        dateFormatted: dateFormatted_
    };

    renderedObj.voteCount_ = {
        likes: likes,
        formatted: numFormatted
    };

    removeProperties(
        renderedObj,
        'actionButtons', 'expandButton', 'loggingDirectives', 'voteCount', 'collapseButton',
        'authorEndpoint', 'authorText', 'isLiked', 'trackingParams'
    );
    return renderedObj;
}

async function collectReplies(comment, data) {
    const renderedReplies = [];

    const replies = comment.replies?.commentRepliesRenderer?.contents?.[0]?.continuationItemRenderer || [];
    let token = extractRepliesToken(replies);

    while (token) {
        const repliesResponse = await axios.post(
            'https://www.youtube.com/youtubei/v1/next',
            {...data, continuation: token}
        );

        const continuationItems = extractContinuationItems(repliesResponse);

        for (const item of continuationItems) {
            if (item.commentRenderer) {
                const repliesRenderer_ = item.commentRenderer;
                const commentRenderer = cleanObj(repliesRenderer_);
                renderedReplies.push(commentRenderer);
            }
        }

        token = extractRepliesTokenNext(continuationItems);
    }
    return renderedReplies;
}

function extractContinuationToken(response) {
    return response.data.contents.twoColumnWatchNextResults.results.results.contents?.[3].itemSectionRenderer.contents
        ?.[0].continuationItemRenderer.continuationEndpoint.continuationCommand.token;
}

function extractContinuationItems(response) {
    const endpoint = response.data.onResponseReceivedEndpoints?.[response.data.onResponseReceivedEndpoints.length - 1];
    return endpoint?.reloadContinuationItemsCommand?.continuationItems || endpoint?.appendContinuationItemsAction
        ?.continuationItems || [];
}

function extractNextPageToken(continuationItems) {
    const lastIndex = continuationItems[continuationItems.length - 1];
    return lastIndex && lastIndex.continuationItemRenderer
        ? lastIndex.continuationItemRenderer.continuationEndpoint.continuationCommand.token
        : null;
}

function extractRepliesTokenNext(continuationItems) {
    const lastIndex = continuationItems[continuationItems.length - 1];

    return lastIndex && lastIndex.continuationItemRenderer
        ? lastIndex.continuationItemRenderer.button.buttonRenderer.command.continuationCommand.token
        : null;
}

function extractRepliesToken(replies) {
    return replies && replies.continuationEndpoint
        ? replies.continuationEndpoint.continuationCommand.token
        : null;
}

async function contextInfo(data, initialResponse) {
    try {
        const response = await axios.post(
            'https://www.youtube.com/youtubei/v1/player',
            data
        );

        const {microformat: {playerMicroformatRenderer: microformat}, videoDetails} = response.data;

        // Extract and assign properties from microformat to videoDetails
        const {
            ownerProfileUrl,
            embed,
            availableCountries,
            hasYpcMetadata,
            category,
            publishDate,
            uploadDate
        } = microformat;

        Object.assign(videoDetails, {
            ownerProfileUrl,
            embed,
            availableCountries,
            hasYpcMetadata,
            category,
            publishDate,
            uploadDate
        });

        // Get accessibilityText where simpleText === "Likes"
        const factoidArray = initialResponse.data.engagementPanels[1].engagementPanelSectionListRenderer.content
            .structuredDescriptionContentRenderer.items[0].videoDescriptionHeaderRenderer.factoid;

        const factoidLikes = factoidArray.find(item => item.factoidRenderer.label.simpleText === "Likes");

        // Extract and assign accessibilityText to videoDetails if "Likes" is found
        if (factoidLikes) {
            videoDetails.likes = factoidLikes.factoidRenderer.accessibilityText;
        }

        return videoDetails;

    } catch (error) {
        console.error('Error fetching video context info:', error);
        return null;
    }
}

module.exports = fetchCommentsWithReplies;