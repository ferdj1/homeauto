function readHTMLImpl() {
    var fs = require('fs');
    var html = fs.readFileSync('impl.html', 'utf8');

    return html;
}

function readDescAsJSONObj() {
    var fs = require('fs');
    var desc = fs.readFileSync('desc.json', 'utf8');

    var jsonInfo = JSON.parse(desc);
    var html = readHTMLImpl();
    var htmlJsonReady = html.replace(/"/g, '\\"');
    htmlJsonReady = htmlJsonReady.replace(/(\r\n|\n|\r)/gm,"");

    jsonInfo["htmlImpl"] =  htmlJsonReady;

    return jsonInfo;
}

module.exports = {
    readHTMLImpl,
    readDescAsJSONObj
};