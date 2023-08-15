const axios = require("axios");

async function contextCaption(videoId, translate, format) {
    //format: json3/xml
    //translate: en

    const context = {
        client: {clientName: 'WEB', clientVersion: '2.9999099'}
    };

    const data = {
        context,
        videoId
    };

    try {
        const response = await axios.post(
            'https://www.youtube.com/youtubei/v1/player',
            data
        );

        const jsonData = response.data.captions.playerCaptionsTracklistRenderer.captionTracks;

        return await fetchAndReturnData(jsonData, translate, format)

    } catch (error) {
        console.error('Error fetching video context info:', error);
        return null;
    }
}

async function fetchAndReturnData(jsonData, translate, format) {
    const results = [];

    for (const item of jsonData) {
        const baseUrl = item.baseUrl;
        //const languageCode = item.languageCode;
        const vssID = item.vssId;

        let url = baseUrl;

        if (format) {
            url += `&fmt=${format}`;
        }

        if (translate) {
            url += `&tlang=${translate}`;
        }

        try {
            const response = await axios.get(url);
            results.push({
                vssID: vssID,
                data: response.data, // You can modify this to extract the required data from the response
            });
        } catch (error) {
            console.error(`Error fetching data for ${vssID}: ${error.message}`);
        }
    }

    //return JSON.stringify(results, null, 2); // Return JSON string with indentation
    return results;
}

module.exports = contextCaption;