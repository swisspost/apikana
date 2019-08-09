const nodePlop = require("node-plop");
const plop = nodePlop(__dirname +`/../plopfile_init.js`, { defaults: {} });

const generator = plop.getGenerator('init');

generator.runActions({ type: 'stream-api',
domain: 'post.ch',
author: 'bovetl',
namespace: 'location.structure',
shortName: 'location-structure',
projectName: 'location-structure-stream-api',
title: 'Location Structure Stream API',
plugins: [ 'maven', 'nuget' ],
javaPackage: 'ch.post.location.structure.v1',
mavenGroupId: 'ch.post.location',
dotnetNamespace: 'Ch.Post.Location.Structure.V1',
dotnetPackageId: 'Ch.Post.Location.Structure.StreamApi',
mqs: 'Kafka' })
