// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.3;

import "./Context.sol";

contract ContextMock is Context {

    function msgSender() public view returns (address) {
        return _msgSender();
    }

    function msgData(uint256 integerValue, string memory stringValue) public view returns(bytes memory, uint256, string memory) {
        return (_msgData(), integerValue, stringValue);
    }
}