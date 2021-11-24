let editor;

ClassicEditor
    .create( document.querySelector('#editor'))
    .then(newEditor => {
        editor = newEditor;
    })
    .catch( error => {
        console.error( error );
    });

// 获取数据
// const editorData = editor.getData();
// get the file element
let file=document.querySelector('#file')
let preview = document.querySelector('#preview')
// once the customer select the file
file.onchange=function () {
        let reader = new FileReader()
        reader.readAsDataURL(this.files[0])
        reader.onload=function () {
            preview.src = reader.result
        }
    }