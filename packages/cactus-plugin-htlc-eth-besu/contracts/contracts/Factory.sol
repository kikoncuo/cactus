// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.3;

import "./Ownable.sol";
import "./HashTimeLock.sol";

contract Factory is Ownable {
  /**
   * @dev Initializes the contract setting the deployer as the initial owner.
   */
  constructor() Ownable(_msgSender()){}

  event Deployed(address addr, uint256 salt);

    /**
     * @dev Deployes a new security smartcontract and changes the ownership.
     */
  function deploy(bytes memory code, uint256 salt) public onlyOwner {
    address addr;
    assembly {
      addr := create2(0, add(code, 0x20), mload(code), salt)
      if iszero(extcodesize(addr)) {
        revert(0, "Problem deploying contract")
      }
    }

    emit Deployed(addr, salt);
  }
  
  function deployAndInitialize(bytes memory code, uint256 salt) public onlyOwner{
    address addr;
    assembly {
      addr := create2(0, add(code, 0x20), mload(code), salt)
      if iszero(extcodesize(addr)) {
        revert(0, 0)
      }
    }
    
    emit Deployed(addr, salt);

  }
}