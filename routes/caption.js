const express = require("express");
const router = express.Router();
const contextCaption = require("../funs/caption");


/* GET video comments and replies. */
router.get('', async function (req, res, next) {
    const {videoId, translate, format} = req.query;

    try {
        const response = await contextCaption(videoId, translate,  format);
        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching video transcript.' });
    }
});

module.exports = router;