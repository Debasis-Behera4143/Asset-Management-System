const { Op } = require('sequelize');
const {
  Asset, AssetCategory, Vendor, Department, Employee, User,
  AssetMovement, AssetHealthScore, AssetAllocation, AssetDocument,
  MaintenanceRequest, WarrantyTracking, AuditLog, QrScanLog,
} = require('../models');
const { generateAssetTag } = require('../utils/assetTagGenerator');
const { generateQrCode } = require('../utils/qrCodeGenerator');
const { calculate: calcDepreciation } = require('../utils/depreciationCalculator');
const { PagedResponse } = require('../utils/apiResponse');
const {
  ResourceNotFoundError,
  BadRequestError,
  BusinessError,
} = require('../middleware/errorHandler');
const auditLogService = require('./auditLogService');
const logger = require('../utils/logger');

/**
 * Asset Service.
 * Full CRUD, search, QR generation, depreciation, movement history.
 */

// ─── Date Validation Helper ──────────────────────────────────────────────────

function validateAssetDates(purchaseDate, warrantyExpiry) {
  if (purchaseDate) {
    const pDate = new Date(purchaseDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (pDate > today) {
      throw new BadRequestError('Purchase date cannot be in the future.');
    }
    if (warrantyExpiry) {
      const wDate = new Date(warrantyExpiry);
      if (wDate < pDate) {
        throw new BadRequestError('Warranty expiry date cannot be before purchase date.');
      }
    }
  }
}

// ─── Create Asset ───────────────────────────────────────────────────────────

async function createAsset(data, currentUserId) {
  if (data.serialNumber) {
    const exists = await Asset.findOne({ where: { serialNumber: data.serialNumber } });
    if (exists) throw new BadRequestError(`Serial number already exists: ${data.serialNumber}`);
  }

  const category = await AssetCategory.findByPk(data.categoryId);
  if (!category) throw new ResourceNotFoundError('Category', 'id', data.categoryId);

  // Validate dates
  validateAssetDates(data.purchaseDate, data.warrantyExpiry);

  // Calculate depreciation
  let currentValue = null;
  if (data.purchaseCost && data.purchaseDate) {
    const dep = calcDepreciation(
      data.purchaseCost,
      category.usefulLife || 5,
      data.purchaseDate
    );
    currentValue = dep.currentValue;
  }

  // Count for sequential tag
  const count = await Asset.count();
  const assetTag = generateAssetTag(count + 1);

  const asset = await Asset.create({
    assetTag,
    assetUniqueId: assetTag,
    name: data.name,
    categoryId: data.categoryId,
    brand: data.brand || null,
    model: data.model || null,
    serialNumber: data.serialNumber || null,
    purchaseDate: data.purchaseDate || null,
    purchaseCost: data.purchaseCost || null,
    currentValue,
    vendorId: data.vendorId || null,
    departmentId: data.departmentId || null,
    assignedToId: data.assignedToEmployeeId || null,
    currentLocation: data.currentLocation || null,
    warrantyExpiry: data.warrantyExpiry || null,
    status: data.status || 'AVAILABLE',
    description: data.description || null,
    specifications: data.specifications || null,
    isActive: true,
    createdById: currentUserId,
  });

  // Generate QR code
  try {
    const qrUrl = await generateQrCode(assetTag);
    asset.qrCodeUrl = qrUrl;
    asset.qrGeneratedAt = new Date();
    asset.qrLastUpdated = new Date();
    await asset.save();
  } catch (err) {
    logger.warn(`QR generation failed for ${assetTag}: ${err.message}`);
  }

  await auditLogService.log('CREATE', 'ASSET', asset.id, null,
    { assetTag: asset.assetTag, name: asset.name }, 'Asset created', currentUserId);

  logger.info(`Asset created: ${assetTag} (${data.name})`);
  return toResponse(await findById(asset.id));
}

// ─── Update Asset ───────────────────────────────────────────────────────────

async function updateAsset(id, data, currentUserId) {
  const asset = await findById(id);
  const oldValues = { status: asset.status, name: asset.name };

  const category = await AssetCategory.findByPk(data.categoryId);
  if (!category) throw new ResourceNotFoundError('Category', 'id', data.categoryId);

  // Validate dates
  validateAssetDates(data.purchaseDate, data.warrantyExpiry);
  if (data.purchaseDate) {
    const pDate = new Date(data.purchaseDate);
    const allocations = await AssetAllocation.findAll({ where: { assetId: id } });
    for (const alloc of allocations) {
      if (alloc.allocatedDate && new Date(alloc.allocatedDate) < pDate) {
        const allocDateStr = new Date(alloc.allocatedDate).toISOString().split('T')[0];
        throw new BadRequestError(`Purchase date cannot be after the asset's allocation date (${allocDateStr}).`);
      }
    }
  }

  // Recalculate depreciation
  let currentValue = asset.currentValue;
  if (data.purchaseCost && data.purchaseDate) {
    const dep = calcDepreciation(
      data.purchaseCost,
      category.usefulLife || 5,
      data.purchaseDate
    );
    currentValue = dep.currentValue;
  }

  await asset.update({
    name: data.name,
    categoryId: data.categoryId,
    brand: data.brand,
    model: data.model,
    serialNumber: data.serialNumber,
    purchaseDate: data.purchaseDate,
    purchaseCost: data.purchaseCost,
    currentValue,
    currentLocation: data.currentLocation,
    warrantyExpiry: data.warrantyExpiry,
    description: data.description,
    specifications: data.specifications,
    vendorId: data.vendorId || asset.vendorId,
    departmentId: data.departmentId || asset.departmentId,
    imageUrl: data.imageUrl !== undefined ? data.imageUrl : asset.imageUrl,
  });

  evictCachedAsset(asset);

  await auditLogService.log('UPDATE', 'ASSET', id, oldValues,
    { status: asset.status, name: asset.name }, 'Asset updated', currentUserId);

  return toResponse(await findById(id));
}

async function updateAssetImage(id, imageUrl, currentUserId) {
  const asset = await findById(id);
  const oldValues = { imageUrl: asset.imageUrl };

  await asset.update({ imageUrl });

  evictCachedAsset(asset);

  await auditLogService.log('UPDATE', 'ASSET', id, oldValues,
    { imageUrl }, 'Asset image updated', currentUserId);

  return toResponse(await findById(id));
}

// ─── Delete Asset ───────────────────────────────────────────────────────────

async function deleteAsset(id, currentUserId) {
  const asset = await findById(id);
  if (asset.status === 'ASSIGNED') {
    throw new BusinessError('Cannot delete an asset that is currently assigned. Return it first.');
  }

  await asset.update({
    isActive: false,
    status: 'DISPOSED',
    disposedAt: new Date(),
  });

  evictCachedAsset(asset);

  await auditLogService.log('DELETE', 'ASSET', id, null, null,
    `Asset soft-deleted: ${asset.assetTag}`, currentUserId);
}

// ─── Get Asset ──────────────────────────────────────────────────────────────

async function getAsset(id) {
  return toResponse(await findById(id));
}

async function getAssetByTag(assetTag) {
  const asset = await Asset.findOne({
    where: { assetTag, isActive: true },
    include: getIncludes(),
  });
  if (!asset) throw new ResourceNotFoundError('Asset', 'tag', assetTag);
  return toResponse(asset);
}

// ─── List & Search ──────────────────────────────────────────────────────────

async function getAssets({ search, status, categoryId, departmentId, page = 0, size = 10, sortBy = 'createdAt', sortDir = 'desc' } = {}) {
  const where = { isActive: true };

  if (status) where.status = status;
  if (categoryId) where.categoryId = categoryId;
  if (departmentId) where.departmentId = departmentId;

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { assetTag: { [Op.like]: `%${search}%` } },
      { brand: { [Op.like]: `%${search}%` } },
      { model: { [Op.like]: `%${search}%` } },
      { serialNumber: { [Op.like]: `%${search}%` } },
    ];
  }

  const allowedSort = ['createdAt', 'name', 'assetTag', 'status', 'purchaseCost', 'currentValue'];
  const orderField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
  const orderDir = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { count, rows } = await Asset.findAndCountAll({
    where,
    include: getIncludes(),
    limit: size,
    offset: page * size,
    order: [[orderField, orderDir]],
    distinct: true,
  });

  return PagedResponse.from(rows.map(toResponse), count, page, size);
}

// ─── Movement History ───────────────────────────────────────────────────────

async function getMovementHistory(assetId, page = 0, size = 20) {
  await findById(assetId); // validate exists

  const { count, rows } = await AssetMovement.findAndCountAll({
    where: { assetId },
    include: [{ model: User, as: 'movedBy', attributes: ['id', 'firstName', 'lastName'] }],
    order: [['movementDate', 'DESC']],
    limit: size,
    offset: page * size,
  });

  return PagedResponse.from(rows, count, page, size);
}

// ─── Record Movement ────────────────────────────────────────────────────────

async function recordMovement(assetId, type, options = {}, movedById) {
  const { fromLocation, toLocation, fromDept, toDept, fromEmployee, toEmployee, reason } = options;
  await AssetMovement.create({
    assetId,
    movementType: type,
    fromLocation: fromLocation || null,
    toLocation: toLocation || null,
    fromDepartment: fromDept || null,
    toDepartment: toDept || null,
    fromEmployee: fromEmployee || null,
    toEmployee: toEmployee || null,
    movedById: movedById || null,
    reason: reason || null,
    movementDate: new Date(),
  });
}

// ─── Status Counts ──────────────────────────────────────────────────────────

async function getStatusCounts() {
  const [total, available, assigned, underRepair, disposed] = await Promise.all([
    Asset.count({ where: { isActive: true } }),
    Asset.count({ where: { isActive: true, status: 'AVAILABLE' } }),
    Asset.count({ where: { isActive: true, status: 'ASSIGNED' } }),
    Asset.count({ where: { isActive: true, status: 'UNDER_REPAIR' } }),
    Asset.count({ where: { isActive: true, status: 'DISPOSED' } }),
  ]);
  return { total, available, assigned, underRepair, disposed };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function findById(id) {
  const asset = await Asset.findOne({
    where: { id, isActive: true },
    include: getIncludes(),
  });
  if (!asset) throw new ResourceNotFoundError('Asset', 'id', id);
  return asset;
}

function getIncludes() {
  return [
    { model: AssetCategory, as: 'category', attributes: ['id', 'name', 'usefulLife'] },
    { model: Vendor, as: 'vendor', attributes: ['id', 'name'], required: false },
    { model: Department, as: 'department', attributes: ['id', 'name'], required: false },
    { model: Employee, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName'], required: false },
    { model: User, as: 'createdBy', attributes: ['id', 'firstName', 'lastName'], required: false },
    { model: AssetHealthScore, as: 'healthScore', required: false },
  ];
}

const assetCache = new Map();
const CACHE_TTL_MS = 30000; // 30 seconds

function getCachedAsset(idOrTag) {
  const cached = assetCache.get(String(idOrTag));
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    logger.debug(`Cache HIT for asset identifier: ${idOrTag}`);
    return cached.data;
  }
  return null;
}

function setCachedAsset(idOrTag, data) {
  assetCache.set(String(idOrTag), {
    data,
    timestamp: Date.now()
  });
}

function evictCachedAsset(asset) {
  if (!asset) return;
  assetCache.delete(String(asset.id));
  if (asset.assetTag) assetCache.delete(String(asset.assetTag));
  if (asset.assetUniqueId) assetCache.delete(String(asset.assetUniqueId));
  logger.debug(`Evicted asset from cache: ID ${asset.id}`);
}

function toResponse(asset) {
  const a = asset.toJSON ? asset.toJSON() : asset;
  return {
    id: a.id,
    assetTag: a.assetTag,
    assetUniqueId: a.assetUniqueId,
    name: a.name,
    brand: a.brand,
    model: a.model,
    serialNumber: a.serialNumber,
    purchaseDate: a.purchaseDate,
    purchaseCost: a.purchaseCost ? parseFloat(a.purchaseCost) : null,
    currentValue: a.currentValue ? parseFloat(a.currentValue) : null,
    currentLocation: a.currentLocation,
    warrantyExpiry: a.warrantyExpiry,
    status: a.status,
    qrCodeUrl: a.qrCodeUrl,
    qrGeneratedAt: a.qrGeneratedAt,
    qrLastUpdated: a.qrLastUpdated,
    imageUrl: a.imageUrl,
    description: a.description,
    specifications: a.specifications,
    isActive: a.isActive,
    categoryId: a.category?.id || a.categoryId,
    categoryName: a.category?.name || null,
    usefulLife: a.category?.usefulLife || null,
    vendorId: a.vendor?.id || a.vendorId,
    vendorName: a.vendor?.name || null,
    departmentId: a.department?.id || a.departmentId,
    departmentName: a.department?.name || null,
    assignedToId: a.assignedTo?.id || a.assignedToId,
    assignedToName: a.assignedTo
      ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : null,
    healthScore: a.healthScore?.healthScore ? parseFloat(a.healthScore.healthScore) : null,
    healthLevel: a.healthScore?.healthLevel || null,
    riskLevel: a.healthScore?.riskLevel || null,
    createdByName: a.createdBy
      ? `${a.createdBy.firstName} ${a.createdBy.lastName}` : null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

async function findByIdentifier(idOrTag) {
  const cached = getCachedAsset(idOrTag);
  if (cached) return cached;

  const isNumeric = /^\d+$/.test(idOrTag);
  const where = { isActive: true };
  if (isNumeric) {
    where.id = idOrTag;
  } else {
    where[Op.or] = [
      { assetTag: idOrTag },
      { assetUniqueId: idOrTag }
    ];
  }
  const asset = await Asset.findOne({
    where,
    include: getIncludes(),
  });
  if (!asset) throw new ResourceNotFoundError('Asset', 'identifier', idOrTag);

  setCachedAsset(String(asset.id), asset);
  if (asset.assetTag) setCachedAsset(asset.assetTag, asset);
  if (asset.assetUniqueId) setCachedAsset(asset.assetUniqueId, asset);

  return asset;
}

async function generateQr(id, currentUserId) {
  const asset = await findById(id);
  const identifier = asset.assetUniqueId || asset.assetTag;
  const qrUrl = await generateQrCode(identifier);
  
  asset.qrCodeUrl = qrUrl;
  asset.qrLastUpdated = new Date();
  await asset.save();

  evictCachedAsset(asset);

  // Send email to admin
  try {
    const { sendQrEmail } = require('./emailService');
    const path = require('path');
    const config = require('../config/env');
    const qrCodePath = path.join(path.resolve(config.app.qrDir), `${identifier}.png`);
    
    const currentUser = await User.findByPk(currentUserId);
    const recipientEmail = currentUser?.email || 'admin@company.com';
    await sendQrEmail(recipientEmail, asset.name, identifier, qrCodePath);
  } catch (err) {
    logger.warn(`Failed to email QR code for ${identifier}: ${err.message}`);
  }

  await auditLogService.log('UPDATE', 'ASSET', asset.id, { qrCodeUrl: asset.qrCodeUrl },
    { qrCodeUrl: asset.qrCodeUrl, qrLastUpdated: asset.qrLastUpdated }, 'Regenerated QR Code', currentUserId);

  return toResponse(asset);
}

async function getAssetHistory(assetId) {
  const asset = await findByIdentifier(assetId);
  const realAssetId = asset.id;

  const [allocations, movements, audits] = await Promise.all([
    AssetAllocation.findAll({
      where: { assetId: realAssetId },
      include: [
        { model: Employee, as: 'employee', attributes: ['id', 'firstName', 'lastName'] },
        { model: User, as: 'allocatedBy', attributes: ['id', 'firstName', 'lastName'] }
      ]
    }),
    AssetMovement.findAll({
      where: { assetId: realAssetId },
      include: [{ model: User, as: 'movedBy', attributes: ['id', 'firstName', 'lastName'] }]
    }),
    AuditLog.findAll({
      where: { entityType: 'ASSET', entityId: realAssetId }
    })
  ]);

  const timeline = [];

  const createAudit = audits.find(a => a.action === 'CREATE');
  timeline.push({
    type: 'CREATED',
    title: 'Asset Created',
    description: createAudit ? createAudit.description : `Asset ${asset.name} was registered.`,
    date: createAudit ? createAudit.createdAt : asset.createdAt,
    user: createAudit?.userEmail || 'System'
  });

  allocations.forEach(alloc => {
    const employeeName = alloc.employee ? `${alloc.employee.firstName} ${alloc.employee.lastName}` : 'Unknown Employee';
    const userName = alloc.allocatedBy ? `${alloc.allocatedBy.firstName} ${alloc.allocatedBy.lastName}` : 'Admin';
    
    timeline.push({
      type: 'ASSIGNED',
      title: 'Asset Allocated',
      description: `Assigned to employee ${employeeName}. Purpose: ${alloc.purpose || 'General'}.`,
      date: alloc.allocatedDate,
      user: userName
    });

    if (alloc.actualReturn) {
      const returnedToUser = alloc.returnedTo ? `${alloc.returnedTo.firstName} ${alloc.returnedTo.lastName}` : 'Admin';
      timeline.push({
        type: 'RETURNED',
        title: 'Asset Returned',
        description: `Returned by employee ${employeeName}. Notes: ${alloc.notes || 'None'}.`,
        date: alloc.actualReturn,
        user: returnedToUser
      });
    }
  });

  movements.forEach(m => {
    if (m.movementType === 'ALLOCATION' || m.movementType === 'RETURN') return;

    let desc = m.reason || `Location or department shift.`;
    if (m.fromLocation && m.toLocation) {
      desc = `Moved location from "${m.fromLocation}" to "${m.toLocation}". ${m.reason || ''}`;
    } else if (m.fromDepartment && m.toDepartment) {
      desc = `Transferred department from "${m.fromDepartment}" to "${m.toDepartment}". ${m.reason || ''}`;
    }

    const userName = m.movedBy ? `${m.movedBy.firstName} ${m.movedBy.lastName}` : 'System';

    timeline.push({
      type: m.movementType === 'TRANSFER' ? 'TRANSFERRED' : (m.movementType || 'MOVEMENT'),
      title: `Asset ${(m.movementType || 'MOVEMENT').replace('_', ' ')}`,
      description: desc,
      date: m.movementDate,
      user: userName
    });
  });

  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  return timeline;
}

async function getAssetMaintenance(assetId) {
  const asset = await findByIdentifier(assetId);
  const realAssetId = asset.id;

  const requests = await MaintenanceRequest.findAll({
    where: { assetId: realAssetId },
    include: [
      { model: User, as: 'requestedBy', attributes: ['id', 'firstName', 'lastName'] },
      { model: User, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName'] }
    ],
    order: [['createdAt', 'DESC']]
  });

  return requests;
}

async function getAssetDocuments(assetId) {
  const asset = await findByIdentifier(assetId);
  const realAssetId = asset.id;

  const documents = await AssetDocument.findAll({
    where: { assetId: realAssetId },
    include: [{ model: User, as: 'uploadedBy', attributes: ['id', 'firstName', 'lastName'] }],
    order: [['createdAt', 'DESC']]
  });

  return documents;
}

async function reportIssue(assetId, data, currentUserId) {
  const asset = await findByIdentifier(assetId);
  const realAssetId = asset.id;

  const count = await MaintenanceRequest.count();
  const { generateMaintenanceNumber } = require('../utils/assetTagGenerator');
  const requestNumber = generateMaintenanceNumber(count + 1);

  const request = await MaintenanceRequest.create({
    requestNumber,
    assetId: realAssetId,
    requestedById: currentUserId,
    issueType: data.issueType || 'OTHER',
    priority: data.priority || 'MEDIUM',
    status: 'OPEN',
    title: data.title || `Issue reported for asset ${asset.assetTag}`,
    description: data.description || 'No description provided.',
    estimatedCost: data.estimatedCost || 0.00
  });

  if (data.priority === 'CRITICAL' || data.priority === 'HIGH') {
    asset.status = 'UNDER_REPAIR';
    await asset.save();
    await recordMovement(realAssetId, 'REPAIR_CENTER', {
      reason: `Flagged for maintenance: ${requestNumber}. Priority: ${data.priority}`,
      fromLocation: asset.currentLocation,
      toLocation: 'Repair Center'
    }, currentUserId);
  }

  await auditLogService.log('CREATE', 'MAINTENANCE_REQUEST', request.id, null,
    { requestNumber, assetId: realAssetId }, `Maintenance reported: ${requestNumber}`, currentUserId);

  evictCachedAsset(asset);

  return request;
}

async function logQrScan(assetId, userId, userEmail, ipAddress, userAgent) {
  try {
    await QrScanLog.create({
      assetId,
      scannedById: userId || null,
      userEmail: userEmail || null,
      deviceInfo: userAgent || 'Unknown Device',
      ipAddress: ipAddress || 'Unknown IP',
      scannedAt: new Date()
    });
  } catch (err) {
    logger.error(`Failed to log QR scan: ${err.message}`);
  }
}

module.exports = {
  createAsset,
  updateAsset,
  deleteAsset,
  getAsset,
  getAssetByTag,
  getAssets,
  getMovementHistory,
  recordMovement,
  getStatusCounts,
  findById,
  toResponse,
  findByIdentifier,
  generateQr,
  getAssetHistory,
  getAssetMaintenance,
  getAssetDocuments,
  reportIssue,
  logQrScan,
  updateAssetImage,
};
