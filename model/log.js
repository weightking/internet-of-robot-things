const mongoose = require('mongoose')
const Joi = require('joi')

const articleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        minLength: 4,
        maxLength: 20
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    publishDate: {
        type: Date,
        default: Date.now
    },
    cover: {
        type: String,
        default: null
    },
    content: {
        type: String
    }
})

const Log = mongoose.model('Log',articleSchema)

function validateLog(log){
    const schema = Joi.object({
        title: Joi.string().min(4).max(20).required(),
        author: Joi.string().required(),
        publishDate: Joi.date().required(),
        content: Joi.string().min(4).max(100).required()
    }).unknown(true)
    return schema.validate(log)
}

module.exports = {
    Log,
    validateLog
}