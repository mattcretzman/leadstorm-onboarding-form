const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { Resend } = require('resend');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// GHL Configuration
const GHL_API_KEY = process.env.GHL_API_KEY || 'pit-4984dd29-6cf2-4172-859c-6ccc53a9a949';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'mEVG4cNTDGfVm2PUOipQ';
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

// Email Configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_FSrgcHCV_FPtBmytEG9JTqu1GsoA2Sr6t';
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'matt@stormbreakerdigital.com';

const resend = new Resend(RESEND_API_KEY);

function buildEmailBody(formData) {
    return `
NEW LEADSTORM ONBOARDING SUBMISSION
====================================
Submitted: ${new Date().toISOString()}

BUSINESS INFO
-------------
Business Name: ${formData.businessName || ''}
Legal Name: ${formData.legalName || ''}
Owner: ${formData.firstName || ''} ${formData.lastName || ''}
Email: ${formData.email || ''}
Phone: ${formData.phone || ''}
Website: ${formData.website || ''}
Address: ${formData.address || ''}, ${formData.city || ''}, ${formData.state || ''} ${formData.zip || ''}, ${formData.country || ''}
Timezone: ${formData.timezone || ''}

SOCIAL MEDIA
------------
Instagram: ${formData.igUsername || ''}
TikTok: ${formData.tiktokUsername || ''}
WhatsApp Business: ${formData.whatsappNumber || ''}

CALENDAR
--------
Available Days: ${formData.availableDays || ''}
Hours: ${formData.startTime || ''} - ${formData.endTime || ''}
Appointment Duration: ${formData.duration || ''} min
Max Per Day: ${formData.maxAppointments || ''}

BOT SETUP
---------
Trigger Keywords: ${formData.triggerKeywords || ''}
Additional Info: ${formData.additionalInfo || ''}

BILLING
-------
Payment Methods: ${formData.paymentMethod || ''}
Bank Name: ${formData.bankName || ''}
Account Number: ${formData.accountNumber || ''}
SINPE Number: ${formData.sinpeNumber || ''}

====================================
FULL RAW SUBMISSION:
${JSON.stringify(formData, null, 2)}
`.trim();
}

// Serve the form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle form submission
app.post('/submit', async (req, res) => {
    const formData = req.body;

    console.log('Form submission received:', {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        business: formData.businessName
    });

    // Send email immediately — this is the reliable backup
    const emailPromise = resend.emails.send({
        from: 'LeadStorm Forms <notifications@stormbreakerdigital.com>',
        to: NOTIFY_EMAIL,
        subject: `[LeadStorm Onboarding] New submission: ${formData.firstName || ''} ${formData.lastName || ''} — ${formData.businessName || ''}`,
        text: buildEmailBody(formData)
    }).then(() => {
        console.log('Email notification sent successfully');
    }).catch(err => {
        console.error('Email failed:', err.message);
    });

    // Try GHL contact creation
    const ghlPromise = (async () => {
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
            tags: ['LeadStorm Onboarding', 'New Client']
        };

        try {
            const ghlResponse = await axios.post(
                `${GHL_BASE_URL}/contacts/upsert`,
                contactData,
                {
                    headers: {
                        'Authorization': `Bearer ${GHL_API_KEY}`,
                        'Version': '2021-07-28',
                        'Content-Type': 'application/json'
                    },
                    timeout: 8000
                }
            );
            const contactId = ghlResponse.data.contact?.id;
            console.log('GHL SUCCESS! Contact ID:', contactId);

            // Add note with full onboarding details
            if (contactId) {
                const noteBody = `LeadStorm AI Onboarding Submission

Business: ${formData.businessName}
Legal Name: ${formData.legalName}

Social Media:
- IG: ${formData.igUsername}
- TikTok: ${formData.tiktokUsername}
- WhatsApp: ${formData.whatsappNumber}

Calendar: ${formData.startTime} - ${formData.endTime}
Duration: ${formData.duration}min | Max/day: ${formData.maxAppointments}

Trigger Keywords: ${formData.triggerKeywords}
Payment Methods: ${formData.paymentMethod}
Bank: ${formData.bankName} | Account: ${formData.accountNumber} | SINPE: ${formData.sinpeNumber}

Additional Info: ${formData.additionalInfo || 'None'}`;

                await axios.post(
                    `${GHL_BASE_URL}/contacts/${contactId}/notes`,
                    { body: noteBody, userId: '' },
                    {
                        headers: {
                            'Authorization': `Bearer ${GHL_API_KEY}`,
                            'Version': '2021-07-28',
                            'Content-Type': 'application/json'
                        },
                        timeout: 8000
                    }
                ).catch(err => console.error('GHL note failed:', err.response?.status, err.message));
            }
        } catch (err) {
            console.error('GHL FAILED:', err.response?.status, JSON.stringify(err.response?.data) || err.message);
        }
    })();

    // Wait for both — email is the critical one
    await Promise.allSettled([emailPromise, ghlPromise]);

    res.json({ success: true, message: 'Form submitted successfully!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`LeadStorm Onboarding Form running on port ${PORT}`);
});
