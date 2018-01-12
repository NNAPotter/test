var express = require('express');
var app = express();
var http = require('http');

var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
var urlencodedParser = bodyParser.urlencoded({extended:false});
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
var mongoDB = require('mongodb');
var MongoClient = mongoDB.MongoClient;
var mongoDBUrl = 'mongodb://localhost:27017/mydatabase';
var request = require('request');
var config = require('./config.js');
var jwt = require('jsonwebtoken');
var rasp_ip_address;
var heroku_rasp_ip_address;
var server = http.createServer(app);
var apiRoutes = express.Router();
app.set('api_key',config.private_key);
server.listen(process.env.PORT||3000);

var optionsGetIP = {
	url:"http://myip.dnsomatic.com/",
	method: 'GET',
	headers:{
		'Content-Type':'text/plain',
	}
};

request(optionsGetIP, function(err, res, body){
	if(err){
		console.log(err);
	} else {
		console.log(body);
		rasp_ip_address = body;
	}
});
/*
var optionsSendIP = {
	url: "http://192.168.0.112:3002/update-rasp",
	method: 'POST',
	headers: {
		'Content-Type':'application/json'
	},
	json:{
		"rasp_id":"RASP001",
		"rasp_ip_address":rasp_ip_address
	}
};

request(optionsSendIP, function(err, res, body){
	if(err){
		console.log(err);
	} else {
		console.log(body);
	}
});
*/
app.get('/', function(req, res){
	res.send('GETTING ' + req.socket.localAddress);
	/*request(options, function(err, res, body){
		if(!err)
			console.log(body);
	});*/
});
app.get('/rasp-ip-address/:ip', function(req, res){
	console.log(req.params.ip);
	rasp_ip_address = req.params.ip;
	res.send(req.params.ip);
});
app.post('/test-token', jsonParser, function(req, res){
	var token = req.body.token || req.query.token || req.headers['x-access-token'];
	if(token){
		jwt.verify(token, app.get('api_key'), function(err, decode){
			if(err){
				console.log(err);
				res.send('ERROR');
			} else {
				console.log(decode);
				res.json(decode);
			}
		});
	} else {
		res.send("Can't find token");
	}
});

app.post('/', jsonParser, function(req, res){
	console.log(req.body);
	res.send('POSTING ' + req.socket.localAddress);
});

app.post('/test', jsonParser, function(req, res){
	console.log("Test");
	res.json(
	{
		"countdata":"1",
		"device":{
			"port":10,
			"control_data":{
				"onoff":"on",
				"data":"10/100"
			}
		}
	}
	);
});

app.get('/info', function(req, res){
	MongoClient.connect(mongoDBUrl, function(err, db){
		if(err){
			console.log(err);
		} else {
			db.collection("device").find({}).toArray(function(err, result) {
				if (err) throw err;
				console.log(result);
				res.json(result);
			});
		}
	});
});

MongoClient.connect(mongoDBUrl, function(err, db){
	if(err){
		console.log(err);
	} else {
		console.log("Connected to mongoDB");
		var collectionDevice = db.collection('device');
		var collectionUsers = db.collection('users');
		collectionUsers.findOne({}, function(err, result){
			if(err){
				console.log(err);
			} else {
				if(result){
					console.log(result);
				} else {
					collectionUsers.insertOne({'user_name':'admin','password':'admin','is_admin':'true'}, function(err, result){
						if(err){
							console.log(err);
						} else {
							console.log('insert password successfully');
							db.close();
						}
					});
				}
			}
		});
	}
});

app.post('/add-esp', jsonParser, function(req, res){
	console.log(req.socket.localAddress);
	console.log(req.connection.remoteAddress);
	MongoClient.connect(mongoDBUrl, function(err, db){
		var collection = db.collection('device');
		var device = {
			"name_device":req.body.device.name_device,
			"esp_ip_address":req.body.esp_ip_address,
			"esp_id":req.body.esp_id,
			"type_device":req.body.device.type_device,
			"port":req.body.device.port,
			"control_data":req.body.device.control_data
		};
		console.log('received device ' + device.name_device);
		collection.findOne({"name_device":device.name_device}, function(err, result){
			if(err) {
				console.log(err);
				res.send("ERROR");
			} else {
				if(result){
					console.log(result.name_device + ' is existing');
					res.send(result.name_device + " existing");
					collection.update({"name_device":result.name_device},{$set:{"esp_ip_address":req.body.esp_ip_address,
						"port":req.body.device.port,"type_device":req.body.device.type_device,"esp_id":req.body.esp_id,"control_data":req.body.device.control_data}}, function(err, result){
						console.log(result.result);
					});
				} else {
					collection.insertOne(device, function(err, result){
						if(err){
							console.log('insert error');
							res.send("ERROR");
						} else {
							console.log('inserted ' + device.name_device);
							res.send("OK");
							db.close();
						}
					});
				}
			}
		});		
	});
});

app.post('/log-in-rasp', jsonParser, function(req, res){
	MongoClient.connect(mongoDBUrl, function(err, db){
		if(err){
			console.log(err);
			res.json({
				"status":"ERROR",
				"log":"Can't connect to MongoDB"
			});
		} else {
			var collectionUsers = db.collection('users');
			var user = {
				"user_name":req.body.user_name,
				"password":req.body.password
			}
			collectionUsers.findOne(user, function(err, result){
				if(err){
					console.log(err);
					res.json({
						"status":"ERROR",
						"log":"Can't connect to MongoDB"
					});
				} else {
					if(result){
						db.collection('device').find({}).toArray(function(err, arrDocuments) {
							var token = jwt.sign(user, app.get('api_key'));
							console.log(config.private_key);
							res.json({
								"status":"OK",
								"log":token,
								"device":arrDocuments,
								"count_device":arrDocuments.length.toString()
							});
						});
					} else {
						console.log(err);
						res.json({
							"status":"ERROR",
							"log":"Password is incorrect"
						});
					}
				}
			});
		}
	});
});

apiRoutes.use(function(req, res, next){
	console.log("Middleware-function");
	var token = req.body.token || req.query.token || req.headers['x-access-token'];
	console.log(token);
	if(token){
		jwt.verify(token, app.get('api_key'), function(err, decode){
			if(err){
				console.log("ERROR: jwt.verify()");
				res.json({
					"status":"ERROR",
					"log":"ERROR: jwt.verify()"
				});
			} else {
				console.log(decode);
				req.decode = decode;
				next();
			}
		});
	} else {
		res.json({
			"status":"ERROR",
			"log":"Can't find the token"
		});
	}
});

apiRoutes.post('/test', function(req, res){
	console.log("api/test");
	console.log(req.decode);
	res.json({
		"status":"OK"
	});
});

apiRoutes.post('/change-password', jsonParser, function(req, res){
	console.log('api/change-password');
	MongoClient.connect(mongoDBUrl, function(err, db){
		if(err){
			console.log(err);
		} else {
			console.log(req.decode);
			var collection = db.collection('users');
			var user = {
				"user_name":req.decode.user_name,
				"password":req.decode.password
			}
			collection.findOne(user, function(err, result){
				if(err){
					res.json({
						"status":"ERROR",
						"log":"ERROR findOne users"
					})
				} else {
					if(result){
						collection.update(result,{$set:{'password':req.body.new_password}}, function(err, result){
							if(err){
								res.json({
									"status":"ERROR",
									"log":"ERROR update users"
								});
							} else {
								var newUser = {
									"user_name":req.decode.user_name,
									"password":req.body.new_password
								}
								console.log(result.result.n);
								var token = jwt.sign(newUser, app.get('api_key'));
								res.json({
									"status":"OK",
									"log":token
								});
							}
						});
					} else {
						res.json({
							"status":"ERROR",
							"log":"user's name or password is incorrect"
						});
					}
				}
			});
		}
	});
});

apiRoutes.post('/add-user', jsonParser, function(req, res){
	console.log('api/add-user');
	MongoClient.connect(mongoDBUrl, function(err, db){
		if(err){
			console.log(err);
		} else {
			console.log(req.decode);
			var collection = db.collection('users');
			var userReq = {
				"user_name":req.decode.user_name,
				"password":req.decode.password
			}
			collection.findOne(userReq, function(err, result){
				if(err){
					res.json({
						"status":"ERROR",
						"log":"ERROR findOne users"
					})
				} else {
					if(result){
						console.log(result);
						if(result.is_admin=='true'){
							var newUser = {
								"user_name":req.body.user_name,
								"password":req.body.password,
								"is_admin":false
							}
							collection.findOne({"user_name":req.body.user_name}, function(err, result){
								if(err){
									res.json({
										"status":"ERROR",
										"log":"ERROR findOne users"
									});
								} else {
									if(!result){
										collection.insertOne(newUser, function(err, result){
											if(err){
												res.json({
													"status":"ERROR",
													"log":"ERROR update users"
												});
											} else {
												console.log(result);
												res.json({
													"status":"OK",
													"log":"Success"
												});
											}
										});
									} else {
										res.json({
											"status":"ERROR",
											"log":newUser.user_name + " is existing"
										});
									}
								}
							});
							
						} else {
							res.json({
								"status":"ERROR",
								"log":"The user is not the admin"
							});
						}
					} else {
						res.json({
							"status":"ERROR",
							"log":"The user is not existing"
						});
					}
				}
			});
		}
	});
});

apiRoutes.post('/control-device', jsonParser, function(req, res){
	console.log('/api/control-device');
	MongoClient.connect(mongoDBUrl, function(err, db){
		if(err){
			console.log(err);
		} else {
			//Check password
			console.log(req.decode);
			var collection = db.collection('users');
			collection.findOne({'user_name':req.decode.user_name,'password':req.decode.password},function(err, result){
				if(err){
					console.log(err);
					res.send("Error in database");
				} else {
					if(result){
						//Find device
						collection = db.collection('device');
						var device = {
							"name_device":req.body.name_device
						};
						collection.findOne(device,function(err, result){
							if(err){
								console.log(err);
								res.send("Error in database");
							} else {
								if(result){
									console.log("result find device: " + result);
									var optionsPost = {
										url:"http://" + result.esp_ip_address + ":3001/control",
										//url:'http://' + result.esp_ip_address + '/control',
										headers:{
											'Content-Type':'application/json'
										},
										json:{
											"port":result.port,
											"control_data":req.body.control_data
										},
										method:'POST'
									};
									var options = {
										url:"http://" + result.esp_ip_address + "/control",
										//url:'http://' + result.esp_ip_address + '/control',
										qs: { port: result.port, onoff: req.body.control_data.onoff, data:req.body.control_data.data },
										method:'GET',
										timeout: 1000,
									};
									//console.log(options.url);
									request(options, function(err, respone, body){
										if(!err){
											console.log(body);
											//var json = JSON.parse(body);
											var json = body;
											//if(json.status=="OK"){
											if(json){
												collection.update({"name_device":req.body.name_device},{$set:{"control_data":req.body.control_data}}, function(err, result){
													if(err){
														console.log(err);
														res.send("Error in database");
													}
													else{
														console.log(result.result.n);
														if(result.result.n!=0)
															res.json({
																"status":"OK",
																"log":"Success"
															});
														else 
															res.json({
																"status":"ERROR",
																"log":"Can't update device status in database"
															});
													}
												});
											} else {
												res.json({
													"status":"ERROR",
													"log":"Can't control the device"
												});
											}
										} else {
											console.log(err);
											res.json({
												"status":"ERROR",
												"log":"Can't request to the device"
											});
										}
									});
								} else {
									res.json({
										"status":"ERROR",
										"log":"Can't find the device"
									});
								}
							}
						});
					} else {
						res.json({
							"status":"ERROR",
							"log":"password is incorrect"
						});
					}
				}
			});
		}
	});
});

app.use('/api',apiRoutes);

var requestLoop = setInterval(function(){
	//if(rasp_ip_address!=old_rasp_ip_address){
		request({
			url: "https://demoherokuserver.herokuapp.com/update-rasp-ip-address",
			//url: "http://192.168.0.9:3002/update-rasp-ip-address",
			method: "POST",
			timeout: 90000,
			followRedirect: true,
			maxRedirects: 10,
			headers: {
				'Content-Type':'application/json'
			},
			json:{
				"rasp_id":"RASP001",
				"rasp_ip_address":rasp_ip_address
			}
		},function(error, response, body){
			//if(!error && response.statusCode == 200){
			if(!error){
				console.log(body);
			}else{
				console.log('ERROR');
			}
		});
	//}
}, 10000);

