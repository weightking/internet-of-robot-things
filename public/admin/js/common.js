function serializeToJson(form) {
    let result = {}
    let f = form.serializeArray()
    f.forEach(function (item) {
        result[item.name] = item.value
    })
    return result
}