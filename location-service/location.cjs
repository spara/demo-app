// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0


// import express  from 'express';
const express = require('express');
const cors = require('cors');
// import cors  from 'cors';
// import * as promBundle from 'express-prom-bundle';
//import AWS location services


const { LocationClient, CreatePlaceIndexCommand, SearchPlaceIndexForTextCommand, DescribePlaceIndexCommand } = require("@aws-sdk/client-location");

const promBundle = require("express-prom-bundle");
const metricsMiddleware = promBundle({
  autoregister: true,
  includeStatusCode: true,
  includePath: true,
  includeMethod: true
});

//init Amazon Location Service and create a place Index
var locationParams = {
  apiVersion: '2020-11-19',
  // credentials are collected via the Environment variables
  //https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-environment.html
};
var client = new LocationClient(locationParams);
var index = 'my_logistics_app';
var params = {
  DataSource: 'Here', /* required */
  IndexName: index, /* required */
  PricingPlan: 'RequestBasedUsage',
  DataSourceConfiguration: {
    IntendedUse: 'SingleUse'
  },
  Description: 'Place index for my_logistics_app'
};

//If the Place Index exists for my_logistics_app, we will reuse it otherwise we create one.
const myLogisticAppIndex = new DescribePlaceIndexCommand({IndexName: index});
// async/await.
var isIndexExist = true;

async function createIndex() {
  try {
    await client.send(myLogisticAppIndex);
  } catch (error) { 
    isIndexExist = false;
    const placeIndexCommand = new CreatePlaceIndexCommand(params);
      // async/await.
      try {
        await client.send(placeIndexCommand);
        // process data.
      } catch (error) {
        console.log(error, error.stack);
      } finally {
        console.log("placeIndex created")
      }
  } finally {
    if(isIndexExist) console.log("PlaceIndex already exists")
  }
}

createIndex();

//Create a server
const app = express();

app.use(cors());
app.use(metricsMiddleware);

app.listen(3000, () => {
  app.get('/searchplace/:text', async function(req, res) { //look for places
    console.log('Looking for the place '+req.params.text)
  
    var textLocation = req.params.text
    var params = {
      IndexName: index, /* required */
      Text: textLocation, /* required */
    };
    const searchCommand = new SearchPlaceIndexForTextCommand(params);
  
    try {
      var data = await client.send(searchCommand)
    } catch (error) {
      console.log(error, error.stack);
    } finally {
        console.log(data);
        res.statusCode = 200;
        var stringData = JSON.stringify(data)
        var jsonParsed = JSON.parse(stringData);
        
        // to geoJSON
        var longitude = jsonParsed.Results[0].Place.Geometry.Point[0];
        var latitude = jsonParsed.Results[0].Place.Geometry.Point[1];
        var city =  jsonParsed.Results[0].Place.Label;
        var bbox = jsonParsed.Summary.ResultBBox;

        let feature = {
            "type" : "FeatureCollection",
            "features" : [{ 
                "bbox" : bbox,
                "type" : "Feature",
                "properties" : {  
                    "name" : city, 
                }, 
                "geometry" : { 
                    "type" : "Point", 
                    "coordinates" : [ longitude, latitude ] 
                }
            }]
        }
        res.send(feature)
      }
    
    })
    
});

