const fs = require('fs'),
  path = require('path'),
  async = require('async'),
  pug = require('pug'),
  rdfTranslator = require('rdf-translator'),
  validUrl = require('valid-url'),
  Filehound = require('filehound');

const config = require('./config.json');

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

var input = validUrl.isUri(source) ? source : fs.readFileSync('temp.json').toString();

var pugOptions = {
  pretty: true
};

// CONVERT IN JSONLD for practical reasons
rdfTranslator(input, guessSourceFormat(source), 'json-ld', (err, data) => {
  if (err)
    return console.error(err);
  parseJsonLD(JSON.parse(data));
});
// var json = JSON.parse(fs.readFileSync('temp.json').toString());
// parseJsonLD(json);

function parseJsonLD(json) {
  // fs.writeFileSync('temp.json', json);

  var context = json['@context'],
    graph = json['@graph'];

  // prune graph from other ns
  var ontPrefix = Object.keys(context).find((prefix) => context[prefix] == namedGraph);
  if (ontPrefix) {
    graph = graph.filter((item) => item['@id'].startsWith(ontPrefix));
    options.ontPrefix = ontPrefix;
  }

  // ONTOLOGY
  var ontology = graph.find(matchClass('owl:Ontology'));
  ontology.namespace = namedGraph;

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
  }, () => {
    console.log('done');
  });

}

function byInnerCode(a, b) {
  let regex = /^[A-Z](\d+)(i)?/;

  let matchA = getHash(a).match(regex);
  let codeA = matchA && matchA[1] || -1;
  if (matchA[2]) codeA += '.1';

  let matchB = getHash(b).match(regex);
  let codeB = matchB && matchB[1] || -1;
  if (matchB[2]) codeB += '.1';

  return parseFloat(codeA) - parseFloat(codeB);
}

function getHash(item) {
  'use strict';
  let uri = item['@id'];
  if(!uri) return null;
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

  if (Array.isArray(value)) {
    if (single)
      return print(value.sort(sortByLang)[0], single);
    else
      return value.map((v) => print(v)).join('\n');
  } else if (value['@id']) {
    return value['@id'];
  } else {
    let text = value['@value'];
    if (!single) {
      let lang = value['@language'];
      if (lang) text += `<small>@${lang}</small>`;
    }
    return text;
  }
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

function runExport(local, callback = noop) {

  // filter the templates
  var pugs = Filehound.create()
    .ext('pug');

  async.series([
    (cb) => {
      // render the pugs
      pugs.paths(options.input)
        .find((err, templates) => {
          templates.forEach((template) => render(template, local));
          cb();
        });
    },
    (cb) => {
      // copy all the other files
      pugs.not().find((err, files) => {
        if (err) throw Error("here" + err);

        files.forEach((file) => {
          let dist = path.join(options.output, file.replace(/[^\/]+\//, ''));
          mkdirInCase(path.dirname(dist));
          copySync(file, dist);
        });
        cb();
      });
    }
  ], callback());
}

function render(template, local) {
  var dist = path.join(options.output, path.basename(template).replace('.pug', '.html'));
  var html = pug.renderFile(template, Object.assign({}, pugOptions, local));

  fs.writeFileSync(dist, html, {
    encoding: 'utf-8'
  });
}

function matchClass(className) {
  return (item) => item["@type"].match(className);
}


function guessSourceFormat(fileName) {
  let ext = fileName.split('.').pop();

  //TODO other formats? http://rdf-translator.appspot.com/
  switch (ext) {
    case 'ttl':
      return 'n3';
    default:
      return 'xml';
  }
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
