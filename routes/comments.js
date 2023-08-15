const express = require("express");
const router = express.Router();
const fetchCommentsWithReplies = require("../funs/comments");


/* GET video comments and replies. */
router.get('/:videoId', async function (req, res, next) {
    const video_id = req.params.videoId;
    try {
        const response = await fetchCommentsWithReplies(video_id);
        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred' });
    }
});

module.exports = router;