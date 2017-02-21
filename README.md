<p align='right'>A <a href="http://www.swisspush.org">swisspush</a> project <a href="http://www.swisspush.org" border=0><img align="top"  src='https://1.gravatar.com/avatar/cf7292487846085732baf808def5685a?s=32'></a></p>
<p align="center">
  <img src="https://cloud.githubusercontent.com/assets/692124/21751899/37cc152c-d5cf-11e6-97ac-a5811f48c070.png"/>
</p>
# Apikana
Integrated tools for REST API design.

Apikana combines the following tools to facilitate the authoring of contract-first REST APIs:

* [Swagger](http://swagger.io/swagger-ui/)
* [typescript-json-schema](https://github.com/YousefED/typescript-json-schema)
* [Docson](https://github.com/lbovet/docson)

It basically generates formal schemas and documentation from a mixed swagger/typescript definition that is easy to author and maintain.

It supports also java:

* Use the provided parent-pom and maven-plugin (see [apikana-java](https://github.com/nidi3/apikana-java)).
* Generate java types (thanks to [jsonschema2pojo](http://www.jsonschema2pojo.org/)).

See it in action in [apikana-sample](https://github.com/lbovet/apikana-sample).

## Usage

### Create a new API project

Install apikana `npm install -g apikana`.
Run `apikana init`.

This starts an interactive wizard that lets you define the main aspects of the API project.

### Use as a global tool

When `apikana start src dist` is executed, it looks in `src/rest/openapi` for a file named `api.yaml` or `api.json`.
This is an [OpenAPI 2.0](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md) file defining the REST API.
Additionally, a `tsModels` element can be given which is an array of typescript files defining the data models.
The typescript files are expected to be in `src/model/ts`. The models should be defined as typescript `interface`s.

At the end, the `dist` directory contains the json schemas and a complete HTML documentation of the API.
Just open a browser at `http://localhost:8333`.

`src/rest/openapi/api.yaml`
````yaml
paths:
  /sample/users:
    get:
      operationId: getUser
      responses:
        200:
          description: ok
          schema:
            $ref: "#/definitions/User"
tsModels:
  - ../../model/ts/user.ts
````

`src/model/ts/user.ts`
````ts
export interface User {
    id: number
    firstName: string // The given name
    lastName: string // the family name @pattern [A-Z][a-z]*
    age?: number
}
````

The `src/style` directory can contain `css` and image files which can be used to style the generated HTML document.


### Use as a devDependency

Instead of being globally installed, apikana can also be defined as a `devDependency` of a project.
A sample configuration would look like:

````json
{
  "name": "My API project",
  "scripts": {
    "start": "apikana start src dist"
  },
  "devDependencies": {
    "apikana": "0.1.7"
  }
}
````

Then simply run `npm start`.
