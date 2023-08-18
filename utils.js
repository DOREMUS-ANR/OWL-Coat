const fs = require('fs-extra');

const options = {};

function getHash(item) {
    'use strict';
    let uri = item['@id'];
    if (!uri) return null;
    if (uri.includes('#'))
        return uri.split('#').pop();
    return options.ontPrefix ? uri.replace(options.ontPrefix + ":", "") : uri;
}

function isSignificative(prop) {
    'use strict';

    var notSignificatifProps = [
        '@type', '@id', 'rdfs:isDefinedBy'
    ];
    return !notSignificatifProps.includes(prop);
}

function print(value, single) {
    'use strict';

    if (typeof value === 'string')
        return value;
    else if (Array.isArray(value)) {
        if (single)
            return print(value.sort(sortByLang)[0], single);
        else
            return value.map((v) => print(v)).join('\n');
    } else if (value['@id']) {
        return `<a href="${regenerateLink(value['@id'])}">${value['@id']}</a>`;
    } else {
        let text = value['@value'];
        if (!single) {
            let lang = value['@language'];
            if (lang) text += `<small>@${lang}</small>`;
        }
        return text;
    }
}

function regenerateLink(short) {
    if (!short.includes(':')) return short;
    const [prefix, id] = short.split(':');

    return options.context[prefix] + id;
}

function sortByLang(a, b) {
    let al = a["@language"],
        bl = b["@language"];

    // first no lang
    if (!al) return -1;
    if (!bl) return 1;
    // then english
    if (al == "en") return -1;
    if (bl == "en") return 1;
    // then the rest
    return al > bl ? 1 : -1;
}

function mkdirInCase(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

function copySync(src, dest) {
    if (!fs.existsSync(src))
        return false;

    fs.createReadStream(src).pipe(fs.createWriteStream(dest));
}

module.exports = {
    getHash,
    mkdirInCase,
    copySync,
    print,
    isSignificative,
    options
}