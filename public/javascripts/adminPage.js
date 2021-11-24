$('.delete').on('click',function () {
    let id = $(this).attr('id')
    $('#deletUserId').val(id)
})