const SHA256 = require('crypto-js/sha256');
const axios = require('axios');
const _ = require('lodash');
const utils = require('./utils');

module.exports = class Blockchain {
  constructor () {
    this.chain = [];
    this.currentTransactions = [];
    this.nodes = [];
  }

  registerNodes (address) {
    /*
         Add a new node to the list of nodes
        :param address: <str> Address of node. Eg. 'http://192.168.0.5:5000'
        :return: None
     */
    if (!_.includes(this.nodes, address)) {
      console.log('adding new node');
      this.nodes.push(address);
    } else {
      console.log('node already added');
    }
  }

  validChain (chain) {
    /*
        Determine if a given blockchain is valid
        :param chain: <list> A blockchain
        :return: <bool> True if valid, False if not
     */
    let lastBlock = chain[0];
    let currentIndex = 1;

    while (currentIndex < chain.length) {
      let block = chain[currentIndex];
      // Check that the hash of the block is correct
      if (block['previousHash'] !== this.hash(lastBlock)) {
        return false;
      }
      // check that proof of work is correct
      if (!this.validProof(lastBlock['proof'], block['proof'])) {
        return false;
      }

      lastBlock = block;
      currentIndex += 1;
    }
    return true;
  }

  async resolveConflict () {
    /*
        This is our Consensus Algorithm, it resolves conflicts
        by replacing our chain with the longest one in the network.
        :return: <bool> True if our chain was replaced, False if not
     */

    let neighbours = this.nodes;
    let newChain;

    // We're only looking for chains longer than ours
    let maxLength = this.chain.length;

    let promises = [];
    for (let i = 0; i < neighbours.length; i++) {
      promises.push(axios.get(`http://${neighbours[i]}/chain`));
    }

    let responses = await Promise.all(promises);

    responses.forEach(res => {
      let length = res.data.length;
      let chain = res.data.chain;

      // Check if the length is longer and the chain is valid
      if (length > maxLength && this.validChain(chain)) {
        console.log('the other chain is valid');
        maxLength = length;
        newChain = chain;
      }
    });

    if (newChain) {
      console.log('replacing old chain with new chain');
      this.chain = newChain;
      console.log('replaced chain: ', this.chain);
      // this.chain = newChain;
      return true;
    }
    console.log('chain not replaced');
    return false;
  }

  newBlock (proof, previousHash = null) {
    /*
        Create a new Block in the Blockchain
        :param proof: <int> The proof given by the Proof of Work algorithm
        :param previous_hash: (Optional) <str> Hash of previous Block
        :return: <dict> New Block
     */
    const block = {
      'index': this.chain.length + 1,
      'timestamp': utils.getUTCTimeString(),
      'transactions': this.currentTransactions,
      'proof': proof,
      'previousHash': previousHash || this.hash(_.last(this.chain))
    };

    this.currentTransactions = [];
    this.chain.push(block);
    return block;
  }

  newTransaction (sender, receiver, amount) {
    /*
        Creates a new transaction to go into the next mined Block
        :param sender: <str> Address of the Sender
        :param recipient: <str> Address of the Recipient
        :param amount: <int> Amount
        :return: <int> The index of the Block that will hold this transaction
    */
    this.currentTransactions.push({
      sender,
      receiver,
      amount
    });
    return this.lastBlock()['index'] + 1;
  }

  lastBlock () {
    return _.last(this.chain);
  }

  hash (block) {
    return SHA256(block.index + block.timestamp + block.transactions + block.proof + block.previousHash).toString();
  }

  proofOfWork (lastProof) {
    /*
        Simple Proof of Work Algorithm:
         - Find a number p' such that hash(pp') contains leading 4 zeroes, where p is the previous p'
         - p is the previous proof, and p' is the new proof
        :param last_proof: <int>
        :return: <int>
     */

    let proof = 0;
    while (this.validProof(lastProof, proof) !== true) {
      proof += 1;
    }
    console.log('found proof');
    return proof;
  }

  validProof (lastProof, proof) {
    /*
        Validates the Proof: Does hash(last_proof, proof) contain 4 leading zeroes?
        :param last_proof: <int> Previous Proof
        :param proof: <int> Current Proof
        :return: <bool> True if correct, False if not.
     */
    let guess = SHA256(lastProof.toString() + proof.toString()).toString();

    return guess.substr(guess.length - 2) === '00'; // 2 is the difficulty
  }
};

