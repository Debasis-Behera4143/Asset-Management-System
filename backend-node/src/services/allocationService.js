const { AssetAllocation, Asset, Employee, User, AssetMovement } = require('../models');
const {
  ResourceNotFoundError, BadRequestError, BusinessError,
} = require('../middleware/errorHandler');
const notificationService = require('./notificationService');
const auditLogService = require('./auditLogService');
const { PagedResponse } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Allocation Service.
 * Manages asset assign, return, transfer lifecycle.
 */

async function assignAsset(data, currentUserId) {
  const asset = await Asset.findByPk(data.assetId);
  if (!asset) throw new ResourceNotFoundError('Asset', 'id', data.assetId);
  if (asset.status !== 'AVAILABLE') {
    throw new BusinessError(`Asset is not available for allocation. Current status: ${asset.status}`);
  }

  const employee = await Employee.findByPk(data.employeeId);
  if (!employee) throw new ResourceNotFoundError('Employee', 'id', data.employeeId);
  if (!employee.isActive) throw new BusinessError('Cannot assign asset to inactive employee.');

  const allocatedDate = data.allocatedDate ? new Date(data.allocatedDate) : new Date();

  if (asset.purchaseDate) {
    const pDate = new Date(asset.purchaseDate);
    if (allocatedDate < pDate) {
      throw new BadRequestError(`Allocation date (${data.allocatedDate || allocatedDate.toISOString().split('T')[0]}) cannot be before the asset's purchase date (${asset.purchaseDate}).`);
    }
  }

  if (data.expectedReturn) {
    const eReturn = new Date(data.expectedReturn);
    if (eReturn < allocatedDate) {
      throw new BadRequestError('Expected return date cannot be before the allocation date.');
    }
  }

  const allocation = await AssetAllocation.create({
    assetId: asset.id,
    employeeId: employee.id,
    allocatedById: currentUserId,
    allocatedDate,
    expectedReturn: data.expectedReturn || null,
    status: 'ACTIVE',
    purpose: data.purpose || null,
    notes: data.notes || null,
  });

  const fromDept = asset.departmentId ? (await asset.getDepartment())?.name : null;
  const toDept = employee.departmentId
    ? (await Employee.findByPk(employee.id, { include: [{ model: require('../models').Department, as: 'department' }] }))?.department?.name
    : null;

  await asset.update({
    status: 'ASSIGNED',
    assignedToId: employee.id,
    departmentId: employee.departmentId || asset.departmentId,
  });

  await AssetMovement.create({
    assetId: asset.id,
    movementType: 'ALLOCATION',
    fromDepartment: fromDept,
    toDepartment: toDept,
    toEmployee: `${employee.firstName} ${employee.lastName}`,
    movedById: currentUserId,
    reason: 'Asset assigned',
    movementDate: new Date(),
  });

  // Notify employee if linked to a user
  if (employee.userId) {
    await notificationService.createNotification(
      employee.userId, 'ASSET_ASSIGNED',
      `Asset Assigned: ${asset.name}`,
      `Asset ${asset.assetTag} has been assigned to you.`,
      'ASSET', asset.id, true
    );
  }

  await auditLogService.log('ASSIGN', 'ALLOCATION', allocation.id, null,
    { assetId: asset.id, employeeId: employee.id }, 'Asset assigned', currentUserId);

  return toResponse(await findAllocationById(allocation.id));
}

async function returnAsset(allocationId, notes, currentUserId) {
  const allocation = await findAllocationById(allocationId);
  if (allocation.status !== 'ACTIVE') {
    throw new BusinessError('This allocation is no longer active.');
  }

  await allocation.update({
    status: 'RETURNED',
    actualReturn: new Date(),
    returnedToId: currentUserId,
    notes: notes || allocation.notes,
  });

  const asset = allocation.asset;
  const fromEmployee = `${allocation.employee.firstName} ${allocation.employee.lastName}`;

  await asset.update({ status: 'AVAILABLE', assignedToId: null });

  await AssetMovement.create({
    assetId: asset.id,
    movementType: 'RETURN',
    fromEmployee,
    movedById: currentUserId,
    reason: 'Asset returned',
    movementDate: new Date(),
  });

  if (allocation.employee.userId) {
    await notificationService.createNotification(
      allocation.employee.userId, 'ASSET_RETURNED',
      `Asset Returned: ${asset.name}`,
      `Asset ${asset.assetTag} has been successfully returned.`,
      'ASSET', asset.id, false
    );
  }

  await auditLogService.log('RETURN', 'ALLOCATION', allocationId, null,
    { assetId: asset.id }, 'Asset returned', currentUserId);

  return toResponse(await findAllocationById(allocationId));
}

async function transferAsset(currentAllocationId, newData, currentUserId) {
  await returnAsset(currentAllocationId, 'Transferred to another employee', currentUserId);
  return assignAsset(newData, currentUserId);
}

async function getAllocations({ status, page = 0, size = 10 } = {}) {
  const where = status ? { status } : {};
  const { count, rows } = await AssetAllocation.findAndCountAll({
    where,
    include: getAllocationIncludes(),
    order: [['allocatedDate', 'DESC']],
    limit: size,
    offset: page * size,
    distinct: true,
  });
  return PagedResponse.from(rows.map(toResponse), count, page, size);
}

async function getAllocation(id) {
  return toResponse(await findAllocationById(id));
}

async function getEmployeeAllocations(employeeId, page = 0, size = 10) {
  const { count, rows } = await AssetAllocation.findAndCountAll({
    where: { employeeId },
    include: getAllocationIncludes(),
    order: [['allocatedDate', 'DESC']],
    limit: size,
    offset: page * size,
  });
  return PagedResponse.from(rows.map(toResponse), count, page, size);
}

// Alias for employee sub-route in employees.js
const getByEmployee = getEmployeeAllocations;

async function getAssetAllocations(assetId, page = 0, size = 10) {
  const { count, rows } = await AssetAllocation.findAndCountAll({
    where: { assetId },
    include: getAllocationIncludes(),
    order: [['allocatedDate', 'DESC']],
    limit: size,
    offset: page * size,
  });
  return PagedResponse.from(rows.map(toResponse), count, page, size);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function findAllocationById(id) {
  const allocation = await AssetAllocation.findByPk(id, { include: getAllocationIncludes() });
  if (!allocation) throw new ResourceNotFoundError('Allocation', 'id', id);
  return allocation;
}

function getAllocationIncludes() {
  return [
    { model: Asset, as: 'asset', attributes: ['id', 'assetTag', 'name', 'status'] },
    { model: Employee, as: 'employee', attributes: ['id', 'firstName', 'lastName', 'employeeCode', 'userId'] },
    { model: User, as: 'allocatedBy', attributes: ['id', 'firstName', 'lastName'], required: false },
    { model: User, as: 'returnedTo', attributes: ['id', 'firstName', 'lastName'], required: false },
  ];
}

function toResponse(a) {
  const obj = a.toJSON ? a.toJSON() : a;
  return {
    id: obj.id,
    assetId: obj.asset?.id || obj.assetId,
    assetTag: obj.asset?.assetTag,
    assetName: obj.asset?.name,
    employeeId: obj.employee?.id || obj.employeeId,
    employeeName: obj.employee ? `${obj.employee.firstName} ${obj.employee.lastName}` : null,
    employeeCode: obj.employee?.employeeCode,
    allocatedById: obj.allocatedBy?.id || obj.allocatedById,
    allocatedByName: obj.allocatedBy
      ? `${obj.allocatedBy.firstName} ${obj.allocatedBy.lastName}` : null,
    allocatedDate: obj.allocatedDate,
    expectedReturn: obj.expectedReturn,
    actualReturn: obj.actualReturn,
    status: obj.status,
    purpose: obj.purpose,
    notes: obj.notes,
    createdAt: obj.createdAt,
  };
}

module.exports = {
  assignAsset,
  returnAsset,
  transferAsset,
  getAllocation,
  getAllocations,
  getEmployeeAllocations,
  getByEmployee,
  getAssetAllocations,
};
