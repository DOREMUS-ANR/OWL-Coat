OWL Coat
========

> ALPHA version

Generate HTML documentation from an Ontology RDF file and a [PUG](https://pugjs.org) template.



## Installation

Clone this report:

    git clone https://github.com/DOREMUS-ANR/OWL-Coat

Install dependencies:

    npm install
    
    
## Usage

Edit the `config.json` file according to your needs:

    {
      "source": <URI or PATH>,  [required]
      "namedGraph": <URI>,  [required]
      "input": [default: "./res/"],
      "output": [default: "./out/"]
    }
    
Run it
  
    node index
  
The `.pug` files will be converted in HTML, while the other files in input will be copied directly in output.

## How to write the PUG template

TBD ...
