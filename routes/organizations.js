const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// CREATE organization (user becomes owner)
router.post('/', authenticateToken, async (req, res) => {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Organization name is required' });
    }

    try {
        // Create organization
        const orgResult = await pool.query(`
            INSERT INTO organizations (name, owner_id) 
            VALUES ($1, $2) 
            RETURNING *
        `, [name.trim(), req.userId]);

        const organization = orgResult.rows[0];

        // Add owner to organization_members
        await pool.query(`
            INSERT INTO organization_members (organization_id, user_id, role)
            VALUES ($1, $2, $3)
        `, [organization.id, req.userId, 'owner']);

        res.status(201).json(organization);

    } catch (error) {
        console.error('Create organization error:', error);
        res.status(500).json({ error: 'Failed to create organization' });
    }
});

// GET user's organizations
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT o.*, om.role, om.joined_at
            FROM organizations o
            JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = $1
            ORDER BY o.created_at DESC
        `, [req.userId]);

        res.json(result.rows);

    } catch (error) {
        console.error('Get organizations error:', error);
        res.status(500).json({ error: 'Failed to get organizations' });
    }
});

// GET single organization (with members)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        // Check if user is member of this organization
        const memberCheck = await pool.query(`
            SELECT role FROM organization_members 
            WHERE organization_id = $1 AND user_id = $2
        `, [req.params.id, req.userId]);

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get organization details
        const orgResult = await pool.query('SELECT * FROM organizations WHERE id = $1', [req.params.id]);

        if (orgResult.rows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Get members
        const membersResult = await pool.query(`
            SELECT u.id, u.email, u.name, om.role, om.joined_at
            FROM organization_members om
            JOIN users u ON om.user_id = u.id
            WHERE om.organization_id = $1
            ORDER BY om.joined_at ASC
        `, [req.params.id]);

        const organization = orgResult.rows[0];
        organization.members = membersResult.rows;
        organization.user_role = memberCheck.rows[0].role;

        res.json(organization);

    } catch (error) {
        console.error('Get organization error:', error);
        res.status(500).json({ error: 'Failed to get organization' });
    }
});

// INVITE USER to organization (owner/admin only)
router.post('/:id/invite', authenticateToken, async (req, res) => {
    const { email, role = 'member' } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const validRoles = ['member', 'admin'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        // Check if user is owner/admin of organization
        const memberCheck = await pool.query(`
            SELECT role FROM organization_members 
            WHERE organization_id = $1 AND user_id = $2
        `, [req.params.id, req.userId]);

        if (memberCheck.rows.length === 0 ||
            !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
            return res.status(403).json({ error: 'Only owners and admins can invite users' });
        }

        // Find user by email
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const targetUser = userResult.rows[0];

        // Check if user is already a member
        const existingMember = await pool.query(`
            SELECT * FROM organization_members 
            WHERE organization_id = $1 AND user_id = $2
        `, [req.params.id, targetUser.id]);

        if (existingMember.rows.length > 0) {
            return res.status(400).json({ error: 'User is already a member' });
        }

        // Add user to organization
        await pool.query(`
            INSERT INTO organization_members (organization_id, user_id, role)
            VALUES ($1, $2, $3)
        `, [req.params.id, targetUser.id, role]);

        res.status(201).json({
            message: 'User invited successfully',
            user: {
                id: targetUser.id,
                email: targetUser.email,
                name: targetUser.name,
                role: role
            }
        });

    } catch (error) {
        console.error('Invite user error:', error);
        res.status(500).json({ error: 'Failed to invite user' });
    }
});

module.exports = router;