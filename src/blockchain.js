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
    if (!_.includes(this.nodes, address)) {
      console.log('adding new node');
      this.nodes.push(address);
    } else {
      console.log('node already added');
    }
  }

  validChain (chain) {
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
    let proof = 0;
    while (this.validProof(lastProof, proof) !== true) {
      proof += 1;
    }
    console.log('found proof');
    return proof;
  }

  validProof (lastProof, proof) {
    let guess = SHA256(lastProof.toString() + proof.toString()).toString();
    return guess.substr(guess.length - 2) === '00'; // 2 is the difficulty
  }
};
