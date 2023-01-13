const fs = require('fs-extra'),
    path = require('path'),
    pug = require('pug'),
    validUrl = require('valid-url'),
    ttl2jsonld = require('@frogcat/ttl2jsonld'),
    Filehound = require('filehound');

const config = require('./config.json');
var context, graph;

// READ OPTIONS
var defaultOpt = {
    output: './out/',
    input: './res/'
};

var options = Object.assign({}, defaultOpt, config);
var {
    source,
    namedGraph
} = options;

if (!source) throw Error('The "source" field is required');
if (!namedGraph) throw Error('The "namedGraph" field is required');

mkdirInCase(options.output);

var input = validUrl.isUri(source) ? source : fs.readFileSync(source).toString();

var pugOptions = {
    pretty: true
};

parseJsonLD(ttl2jsonld.parse(input))


function parseJsonLD(json) {
    // fs.writeFileSync('temp.json', JSON.stringify(json, null, 2));

    context = json['@context'];
    graph = json['@graph'];

    // ONTOLOGY
    var ontology = graph.find(matchClass('owl:Ontology'));
    ontology.namespace = namedGraph;

    // prune graph from other ns
    var ontPrefix = Object.keys(context).find((prefix) => context[prefix] == namedGraph);
    if (ontPrefix) {
        graph = graph.filter((item) => item['@id'].startsWith(ontPrefix));
        options.ontPrefix = ontPrefix;
    }

    // CLASSES
    var classes = graph.filter(matchClass('owl:Class'));

    // PROPERTIES
    var properties = graph.filter(matchClass(/owl:(Object|Datatype)Property/));

    // FIXME this is a DOREMUS/FRBROO fix
    classes = classes.sort(byInnerCode);
    properties = properties.sort(byInnerCode);

    runExport({
        ontology,
        classes,
        properties,
        utils: {
            print,
            getHash,
            isSignificative
        }
    }).then(console.log('done'))

}

function byInnerCode(a, b) {
    let regex = /^[A-Z](\d+)(i)?/;

    let matchA = getHash(a).match(regex);
    let codeA = matchA && matchA[1] || -1;
    if (matchA && matchA[2]) codeA += '.1';

    let matchB = getHash(b).match(regex);
    let codeB = matchB && matchB[1] || -1;
    if (matchB && matchB[2]) codeB += '.1';

    return parseFloat(codeA) - parseFloat(codeB);
}

function getHash(item) {
    'use strict';
    let uri = item['@id'];
    if (!uri) return null;
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

    return context[prefix] + id;
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

function runExport(local) {

    // filter the templates
    var pugs = Filehound.create().ext('pug');

    // render pug files
    return pugs.paths(options.input)
        .find()
        .then(templates => Promise.all(templates.map(template => render(template, local))))
        .then(() => pugs.not().find()) // copy all the other files
        .then(files => {
            files.forEach((file) => {
                let dist = path.join(options.output, file.replace(/[^/]+\//, ''));
                mkdirInCase(path.dirname(dist));
                copySync(file, dist);
            });
        });
}

function render(template, local) {
    var dist = path.join(options.output, path.basename(template).replace('.pug', '.html'));
    var opt = Object.assign({}, pugOptions, local);
    var html = pug.renderFile(template, opt);
    return fs.writeFile(dist, html, { encoding: 'utf-8' });
}

function matchClass(className) {
    return (item) => {
        let typ = item["@type"] || item["rdf:type"];
        // console.log(className, typ['@id'], typ['@id'] == className, typ);
        if (Array.isArray(typ))
            return typ.some((t) => t['@id'].match(className));
        return typ['@id'].match(className);
    };
}


function mkdirInCase(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

function copySync(src, dest) {
    if (!fs.existsSync(src)) {
        return false;
    }

    fs.createReadStream(src).pipe(fs.createWriteStream(dest));
}