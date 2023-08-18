const fs = require('fs-extra'),
    path = require('path'),
    pug = require('pug'),
    validUrl = require('valid-url'),
    ttl2jsonld = require('@frogcat/ttl2jsonld'),
    Filehound = require('filehound');
const utils = require('./utils.js')

const config = require('./config.json');
var context, graph;

// READ OPTIONS
const defaultOpt = {
    output: './out/',
    input: './res/'
};

var options = Object.assign(utils.options, defaultOpt, config);
var {
    source,
    namedGraph
} = options;

if (!source) throw Error('The "source" field is required');
if (!namedGraph) throw Error('The "namedGraph" field is required');

utils.mkdirInCase(options.output);

var input = validUrl.isUri(source) ? source : fs.readFileSync(source).toString();

var pugOptions = {
    pretty: true
};

parseJsonLD(ttl2jsonld.parse(input))


function parseJsonLD(json) {
    // fs.writeFileSync('temp.json', JSON.stringify(json, null, 2));

    context = json['@context'];
    graph = json['@graph'];
    options.context = context;

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
    var classes = graph.filter(matchClass(/(owl|rdfs):Class/));

    // PROPERTIES
    var properties = graph.filter(matchClass(/(owl|rdf):(Object|Datatype)?Property/));

    // FIXME this is a DOREMUS/FRBROO fix
    classes = classes.sort(byInnerCode);
    properties = properties.sort(byInnerCode);

    runExport({
        ontology,
        classes,
        properties,
        utils
    }).then(console.log('done'))

}

function byInnerCode(a, b) {
    let regex = /^[A-Z](\d+)(i)?/;

    let matchA = utils.getHash(a).match(regex);
    let codeA = matchA && matchA[1] || -1;
    if (matchA && matchA[2]) codeA += '.1';

    let matchB = utils.getHash(b).match(regex);
    let codeB = matchB && matchB[1] || -1;
    if (matchB && matchB[2]) codeB += '.1';

    return parseFloat(codeA) - parseFloat(codeB);
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
                utils.mkdirInCase(path.dirname(dist));
                utils.copySync(file, dist);
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