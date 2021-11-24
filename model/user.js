const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const Joi = require('joi')

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        minLength: 2,
        maxLength: 20
    },
    email: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true
    },
    state: {
        type: Number,
        default: 0
    }
})

const User = mongoose.model('User',userSchema)

async function createUser(){
    const salt = await bcrypt.genSalt(10)
    const pass = await bcrypt.hash('123456',salt)
    const user = await User.create({
        username: 'duo',
        email: 'duo.zhang13@gmail.com',
        password: pass,
        role: 'admin',
        state: 0
    })
}
//createUser()

function validateUser(user){
    const schema = Joi.object({
        username: Joi.string().min(2).max(12).required(),
        email: Joi.string().email().required(),
        password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required(),
        role: Joi.string().valid('normal','admin').required(),
        state: Joi.number().valid(0,1).required()
    })
    return schema.validate(user)
}



module.exports = {
    User,
    validateUser
}