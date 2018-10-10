## A simple blockchain implementation in JS

##### requirements:
- Node Version: v8.11.1 or above (for development and running without docker)
- Docker Version: 18.06.1-ce or above
- Docker-Compose Version: 1.22.0 or above

##### Steps to run with Docker:
- docker-compose up --build

##### Steps to run without Docker:
- PORT=5000 nodemon src/index.js (replace 5000 with a port of your choice )

With docker, 3 nodes will spin up inside separate containers.
If you want to create additional nodes, you can either make changes to the docker-compose file to do that or manually start a new server

##### API Endpoints:
***

###### Get existing chain of a node
* `GET localhost:3000/chain`

###### Add a new transaction to the node
* `POST localhost:3000/transactions/new`

* __Body__: A transaction to be added

```json
{
	"sender": "3000",
	"receiver": "3000",
	"amount": 4,
	"broadcast": true
}
```
  here, the broadcast field tell the node to broadcast the transaction to other nodes in the network.


###### Mine a new block on the node
* `GET localhost:3000/mine`


###### Resolve conflicts in the existing chain on the node
* `GET localhost:3000/nodes/resolve`


###### Add new nodes to the network
* `POST localhost:3000/nodes/register`

* __Body__: List of nodes to be added

```json
{
	"nodes": ["node-3:3002", "node-2:3001"]
}
```
  here, the array will contain the addresses of the other nodes. Currently, each node must be added to each node separately.
  So, if you have 3 nodes, you will need to register the other 2 nodes by invoking this API on each node with the address of the other 2 nodes.


##### Postman collection for the apis added!
***

##### Credits for the original implementation:  [Link](https://hackernoon.com/learn-blockchains-by-building-one-117428612f46)