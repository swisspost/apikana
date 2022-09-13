<p align='right'>A <a href="https://developer.post.ch/">swisspost</a> project <a href="https://developer.post.ch/" border=0><img align="top"  src='https://avatars.githubusercontent.com/u/92710854?s=32&v=4'></a></p>
<p align="center">
  <img src="https://cloud.githubusercontent.com/assets/692124/21751899/37cc152c-d5cf-11e6-97ac-a5811f48c070.png"/>
</p>

# Apikana

[![Build project](https://github.com/swisspost/apikana/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/swisspost/apikana/actions/workflows/build.yml) <a href="https://www.npmjs.com/package/apikana"><img src="https://img.shields.io/npm/v/apikana"/></a>

Integrated tools for REST and Messaging API design.

Apikana combines the following tools to facilitate the authoring of contract-first REST APIs:

* [Swagger](http://swagger.io/swagger-ui/)
* [typescript-json-schema](https://github.com/YousefED/typescript-json-schema)
* [Docson](https://github.com/lbovet/docson)

It basically generates formal schemas and documentation from a mixed swagger/typescript definition that is easy to author and maintain.

It supports also java:

* Generate java types (thanks to [jsonschema2pojo](http://www.jsonschema2pojo.org/)).

Serialization/Deserialization of java objects:
* The implementation needs a jackson module for serializing and deserializing the objects as described [here](https://github.com/FasterXML/jackson-modules-java8/tree/master/datetime).

## Usage

### Create a new API project

Install apikana `npm install -g apikana`.
Run `apikana init`.

This starts an interactive wizard that lets you define the main aspects of the API project.

Then enter the project directory and run `npm install` to install all the required dependencies.

### Use as a global tool

When `apikana start` is executed, it looks in `src/openapi` for a file named `api.yaml`.
This is an [OpenAPI 2.0](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md) file defining the REST API.
In the `definitions` section a `$ref` can be given which references typescript file(s) defining the data models.
`$ref` can be a comma or newline separated string or an array thereof.
The models should be defined as typescript `export interface`s.

At the end, the `dist` directory contains the json schemas and a complete HTML documentation of the API.
Just open a browser at `http://localhost:8333`.

`src/openapi/api.yaml`
```yaml
paths:
  /sample/users:
    get:
      operationId: getUser
      responses:
        200:
          description: ok
          schema:
            $ref: "#/definitions/User"
definitions:
  $ref: ../ts/user.ts
```

`src/ts/user.ts`
```ts
export interface User {
    id: number
    firstName: string // The given name
    lastName: string // the family name @pattern [A-Z][a-z]*
    age?: number
}
```

Annotations like `@pattern` can be used to specify more precise constraints. They correspond to the [JSON Schema validation keywords](https://json-schema.org/latest/json-schema-validation.html#rfc.section.6).  

The `src/style` directory can contain `css` and image files which can be used to style the generated HTML document.

The `gen` directory contain the generated files relative to the enabled plugins.
This files can be overwritten by defining a `templates` directory in the root folder of the project using the following directory structure:
`root_directory/templates/plugin_name/gen/plugin_name/filename.ext` where:
* `root_directory` is the root directory of the project, 
* `plugin_name` is the plugin name (for example `maven` or `dotnet`) and
* `filename.ext` is the file to copy in the `gen` directory (for example `pom.xml` or `api.csproj`).

Matching filenames will be overwritten. All others will be copied in the `gen` directory.

> **A note on Java code generation**
>
> By default Apikana generates Maven SNAPSHOT version for release candidates (version number of the stream api looks like `1.0.0-rc.3`). Due to a bug in Apikana < 0.9.23 it also considered versions like `1.0.0-feature-test.13` as release candidates. This old buggy behavior can be restored by configuring a setting in the generated stream api `package.json` file:
> ```json
> // File package.json
> {
>   // ...
>   "customConfig": {
>     // ...
>     "snapshotVersion": "ALL_NON_FINAL"
>     // ...
>   }
> }
> ```


### Use as a devDependency

Instead of being globally installed, apikana can also be defined as a `devDependency` of a project.
A sample configuration would look like:

```json
{
  "name": "My API project",
  "scripts": {
    "start": "apikana start src"
  },
  "devDependencies": {
    "apikana": "0.7.1"
  }
}
```

Then simply run `npm run start`.


## Development

Development is done within feature branches in forked repositories. When ready
it gets merged to _swisspost/develop_ via merge request (at best including review).

> Make sure to comply with the [conventional commits specification](https://www.conventionalcommits.org/en/v1.0.0/) when writing commit or squash commit messages, as they control the next version when releasing!


### Testing

You can run tests using `npm test` within projects root directory.


### Releasing

Releasing is done automatically using [semantic-release](https://semantic-release.gitbook.io/semantic-release/) when merging to develop and master.

Merging to `develop` will release to the `next` distribution channel on npm, merging to `master` will publish that release to the main distribution channel.

> **IMPORTANT**
>
> If the conventional commits result in a new release (i.e. having `feat:`, `fix:` or `BREAKING` in a message), merging to `master` will trigger a new release on _npmjs.org_ **automatically** without any further user interaction!

### Publishing

To publish to _npmjs.org_ locally, the environment variable `NPM_TOKEN` must be set. You
can accomplish this by executing `npm login` locally and afterwards extracting
corresponding value from `~/.nmprc`.

