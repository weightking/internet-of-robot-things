// module for analysis the get and post request parameters, support binary and upload request
const formidable = require('formidable')
const path = require('path')
const {User} = require('../../model/user')
const {Log, validateLog} = require('../../model/log')

module.exports = async (req, res, next) => {
    const validation = await validateLog((req.body))
    let form = new formidable.IncomingForm()
    // to define the directory for the upload file
    form.uploadDir = path.join(__dirname, '../', '../', 'public', 'upload')
    // to keep the extension of file
    form.keepExtensions = true
    form.parse(req, async (err, fields, files) => {
        const validation = await validateLog(fields)
        if (validation.error) {
            //render the error message
            next(JSON.stringify({path: '/admin/log-add', message: validation.error.details[0].message}))
            res.send(validation)
        } else {
            const author = fields.author
            let user = await User.find({username:author})
            let id = user[0]._id
            await Log.create({
                title: fields.title,
                author: id,
                publishDate: fields.publishDate,
                cover: files.cover.path.split('public')[1],
                content: fields.content
            })
            res.redirect('/admin/log')
        }
    })
}