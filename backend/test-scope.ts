import { Settings } from './src/db';

const defaultScopes = [
    'r_liteprofile',
    'r_emailaddress',
    'w_member_social',
    'w_organization_social',
    'r_organization_social',
    'rw_organization_admin'
];
const requestedScopes = process.env.LINKEDIN_SCOPES ? process.env.LINKEDIN_SCOPES.split(',') : defaultScopes;

const scope = encodeURIComponent(requestedScopes.join(' '));
console.log(scope);
