const { Op } = require('sequelize');
const { WarrantyTracking, Asset } = require('../models');
const { ResourceNotFoundError, BadRequestError } = require('../middleware/errorHandler');
const { PagedResponse } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Warranty Service.
 */

async function getAll(page = 0, size = 10) {
  const { count, rows } = await WarrantyTracking.findAndCountAll({
    include: [{ model: Asset, as: 'asset', attributes: ['id', 'assetTag', 'name'] }],
    order: [['expiryDate', 'ASC']],
    limit: size,
    offset: page * size,
  });
  return PagedResponse.from(rows.map(toResponse), count, page, size);
}

async function getExpiring(days = 30, page = 0, size = 10) {
  const from = new Date().toISOString().split('T')[0];
  const to = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { count, rows } = await WarrantyTracking.findAndCountAll({
    where: { expiryDate: { [Op.between]: [from, to] } },
    include: [{ model: Asset, as: 'asset', attributes: ['id', 'assetTag', 'name'] }],
    order: [['expiryDate', 'ASC']],
    limit: size,
    offset: page * size,
  });

  return PagedResponse.from(rows.map(toResponse), count, page, size);
}

async function getForAsset(assetId) {
  const warranty = await WarrantyTracking.findOne({
    where: { assetId },
    include: [{ model: Asset, as: 'asset', attributes: ['id', 'assetTag', 'name'] }],
  });
  if (!warranty) throw new ResourceNotFoundError('Warranty', 'assetId', assetId);
  return toResponse(warranty);
}

async function createOrUpdate(assetId, data) {
  const asset = await Asset.findByPk(assetId);
  if (!asset) throw new ResourceNotFoundError('Asset', 'id', assetId);

  const existing = await WarrantyTracking.findOne({ where: { assetId } });
  const startDate = data.startDate !== undefined ? data.startDate : existing?.startDate;
  const expiryDate = data.expiryDate !== undefined ? data.expiryDate : existing?.expiryDate;

  if (startDate && expiryDate) {
    if (new Date(expiryDate) < new Date(startDate)) {
      throw new BadRequestError('Warranty expiry date cannot be before start date.');
    }
  }
  if (startDate && asset.purchaseDate) {
    if (new Date(startDate) < new Date(asset.purchaseDate)) {
      throw new BadRequestError(`Warranty start date cannot be before the asset's purchase date (${asset.purchaseDate}).`);
    }
  }

  const [warranty] = await WarrantyTracking.findOrCreate({
    where: { assetId },
    defaults: { assetId, ...data },
  });

  if (warranty && Object.keys(data).length) {
    await warranty.update(data);
  }

  return toResponse(await WarrantyTracking.findOne({
    where: { assetId },
    include: [{ model: Asset, as: 'asset', attributes: ['id', 'assetTag', 'name'] }],
  }));
}

function toResponse(w) {
  const obj = w.toJSON ? w.toJSON() : w;
  const today = new Date();
  const expiryDate = obj.expiryDate ? new Date(obj.expiryDate) : null;
  const daysRemaining = expiryDate
    ? Math.ceil((expiryDate - today) / (24 * 60 * 60 * 1000)) : null;

  return {
    id: obj.id,
    assetId: obj.asset?.id || obj.assetId,
    assetTag: obj.asset?.assetTag,
    assetName: obj.asset?.name,
    warrantyType: obj.warrantyType,
    startDate: obj.startDate,
    expiryDate: obj.expiryDate,
    daysRemaining,
    isExpired: daysRemaining !== null ? daysRemaining < 0 : false,
    isExpiringSoon: daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30,
    providerName: obj.providerName,
    contractNumber: obj.contractNumber,
    notes: obj.notes,
    createdAt: obj.createdAt,
  };
}

module.exports = { getAll, getExpiring, getForAsset, createOrUpdate };
