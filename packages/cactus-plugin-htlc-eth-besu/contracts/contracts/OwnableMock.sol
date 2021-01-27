// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.3;

import "./Ownable.sol";

contract OwnableMock is Ownable {
    constructor(address payable owner) Ownable(owner) {}
}