var express = require('express');
const axios = require('axios');
var router = express.Router();

function videoContext(videoId) {
    /*const params = {
        key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
        prettyPrint: "true"
    };*/

    const data = {
        context: {
            client: {
                clientName: "WEB",
                clientVersion: "2.9999099"
            }
        },
        videoId: videoId
    };

    return axios.post(
        "https://www.youtube.com/youtubei/v1/player",
        data
        //{ params: params }
    );
}

/* GET video context. */
router.get('/:videoId', async function (req, res, next) {
    const video_id = req.params.videoId;
    await videoContext(video_id)
        .then(response => {
            res.json(response.data); // Send the response data as JSON
        })
        .catch(error => {
            console.error(error);
            res.status(500).json({error: 'An error occurred'}); // Send an error response
        });
});

module.exports = router;
