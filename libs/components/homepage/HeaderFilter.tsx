import React from 'react';
import { useRouter } from 'next/router';
import { Button, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'next-i18next';
export default function HeaderFilter() {
 const router=useRouter(); const {t}=useTranslation('common');
 return <Stack spacing={3} sx={{color:'white',p:3}}><Typography variant="h2">{t('Discover your next trip')}</Typography><Stack component="form" direction={{xs:'column',sm:'row'}} spacing={2} onSubmit={(e: React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const text=new FormData(e.currentTarget).get('text');void router.push({pathname:'/tour',query:typeof text==='string'?{text}: {}});}}><TextField name="text" label={t('Destination or tour')} sx={{background:'white',borderRadius:1}} /><Button type="submit" variant="contained">{t('Search')}</Button></Stack></Stack>;
}
