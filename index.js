const fs = require('fs'),
  pug = require('pug'),
  rdfTranslator = require('rdf-translator');

var uri = 'https://raw.githubusercontent.com/DOREMUS-ANR/doremus-ontology/master/doremus.ttl';
var namedGraph = 'http://data.doremus.org/ontology#';
var selectedLanguage = 'fr';

var pugOptions = {
  filename: 'out/output.html',
  pretty: true
};

rdfTranslator(uri, guessSourceFormat(uri), 'json-ld', (err, data) => {
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
  ontPrefix = 'mus';
  graph = graph.filter((item) => item['@id'].startsWith(ontPrefix));

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

  render({
    ontology,
    classes,
    properties,
    utils: {
      print,
      getHash,
      isSignificative
    }
  });
  console.log('done');
}

function byInnerCode(a, b) {
  let regex = /^[A-Z](\d+)/;
  let matchA = getHash(a).match(regex);
  let codeA = matchA && matchA[1] || -1;
  let matchB = getHash(b).match(regex);
  let codeB = matchB && matchB[1] || -1;

  return parseInt(codeA) - parseFloat(codeB);
}

function getHash(item) {
  'use strict';
  let uri = item['@id'];
  return uri && uri.replace(ontPrefix + ":", "");
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
  } else if (value['@id'])
    return value['@id'];
  else {
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

function render(local) {
  var html = pug.renderFile('res/template.pug', Object.assign({}, pugOptions, local));

  fs.writeFileSync('out/out.html', html);

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
