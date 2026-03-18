const express = require('express');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// GHL Configuration
const GHL_API_KEY = process.env.GHL_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb21wYW55X2lkIjoiblNLTmN5VkliMVBGc1BmaDBOOHYiLCJ2ZXJzaW9uIjoxLCJpYXQiOjE3Njk3MDAyNTkzODEsInN1YiI6ImpnbnZZalJMZGhiajhvWWN3TkhJIn0.VZiHAl97Y0fJSo6llU4bUa_9Ek-T5QLujKedgKNJXiY';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'mEVG4cNTDGfVm2PUOipQ';
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

// Serve the form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle form submission
app.post('/submit', upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'scripts', maxCount: 1 },
    { name: 'clientList', maxCount: 1 },
    { name: 'faqFile', maxCount: 1 }
]), async (req, res) => {
    try {
        const formData = req.body;
        
        // Build contact data for GHL
        const contactData = {
            locationId: GHL_LOCATION_ID,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            name: `${formData.firstName} ${formData.lastName}`,
            address1: formData.address,
            city: formData.city,
            state: formData.state,
            postalCode: formData.zip,
            country: formData.country,
            website: formData.website,
            timezone: formData.timezone,
            tags: ['LeadStorm Onboarding', 'New Client'],
            customFields: [
                { key: 'business_name', value: formData.businessName },
                { key: 'legal_business_name', value: formData.legalName },
                { key: 'instagram_username', value: formData.igUsername },
                { key: 'instagram_email', value: formData.igEmail },
                { key: 'tiktok_username', value: formData.tiktokUsername },
                { key: 'whatsapp_number', value: formData.whatsappNumber },
                { key: 'available_days', value: formData.availableDays },
                { key: 'appointment_duration', value: formData.duration },
                { key: 'trigger_keywords', value: formData.triggerKeywords },
                { key: 'ideal_client', value: formData.idealClient },
                { key: 'payment_method', value: formData.paymentMethod },
                { key: 'onboarding_status', value: 'Submitted' }
            ],
            notes: `
LeadStorm AI Onboarding Submission

Business: ${formData.businessName}
Legal Name: ${formData.legalName}

Social Media:
- IG: ${formData.igUsername}
- TikTok: ${formData.tiktokUsername}
- WhatsApp: ${formData.whatsappNumber}

Calendar: ${formData.startTime} - ${formData.endTime}, ${formData.duration}min appointments
Max per day: ${formData.maxAppointments}

Trigger Keywords: ${formData.triggerKeywords}

Additional Info: ${formData.additionalInfo || 'None'}
            `.trim()
        };

        // Send to GHL
        const ghlResponse = await axios.post(
            `${GHL_BASE_URL}/contacts/`,
            contactData,
            {
                headers: {
                    'Authorization': `Bearer ${GHL_API_KEY}`,
                    'Version': '2021-07-28',
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('GHL Contact Created:', ghlResponse.data.contact?.id);

        // Clean up uploaded files
        if (req.files) {
            Object.values(req.files).forEach(fileArray => {
                fileArray.forEach(file => {
                    fs.unlink(file.path, err => {
                        if (err) console.error('Error deleting file:', err);
                    });
                });
            });
        }

        res.json({ 
            success: true, 
            message: 'Form submitted successfully!',
            contactId: ghlResponse.data.contact?.id 
        });

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error submitting form. Please try again.' 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`LeadStorm Onboarding Form running on port ${PORT}`);
});
