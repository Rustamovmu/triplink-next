import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import withLayoutBasic from '../../libs/components/layout/LayoutBasic';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
function About() {
	const { t } = useTranslation('common');
	return (
		<div className="triplink-about">
			<section className="triplink-about__hero">
				<div>
					<h1>{t('A journey starts with a connection.')}</h1>
					<p>{t('Discover tours, follow travel agents, and share your journeys.')}</p>
					<Link href="/tour" className="triplink-about__button">
						{t('Explore tours')}
					</Link>
				</div>
			</section>
			<div className="triplink-about__main">
				<section className="triplink-about__story" aria-labelledby="about-story-title">
					<div className="triplink-about__story-copy">
						<p className="triplink-about__label">{t('About TripLink')}</p>
						<h2 id="about-story-title">{t('More than a place to go.')}</h2>
						<p>
							{t(
								'TripLink brings tours, travel agents, and community stories together. Find a trip that fits your interests, get to know the people behind it, and discover perspectives from other travelers.',
							)}
						</p>
						<p>
							{t('From the first idea to the stories you bring home, there is a place for every part of your journey.')}
						</p>
					</div>
					<figure>
						<Image
							src="/img/homepage/bali.jpg"
							alt={t('Waves meeting the shore at sunset in Bali')}
							width={2560}
							height={1440}
							sizes="(max-width: 700px) 100vw, 50vw"
						/>
						<figcaption>{t('Bali, Indonesia')}</figcaption>
					</figure>
				</section>
				<section className="triplink-about__discover" aria-labelledby="about-discover-title">
					<div className="triplink-about__section-heading">
						<h2 id="about-discover-title">{t('Your travel world, connected.')}</h2>
						<p>{t('Find your next trip. Meet its guide. Keep the story going.')}</p>
					</div>
					<div className="triplink-about__cards">
						<Link href="/tour" passHref>
							<ExploreOutlinedIcon aria-hidden="true" />
							<h3>{t('Find a journey that fits')}</h3>
							<p>
								{t(
									'Explore destinations, compare tour details, and choose the dates and experiences that work for you.',
								)}
							</p>
							<span>{t('Browse tours')}</span>
						</Link>
						<Link href="/agent" passHref>
							<PeopleOutlineIcon aria-hidden="true" />
							<h3>{t('Meet the people behind the trip')}</h3>
							<p>{t('Explore agent profiles, discover their tours, and follow the people whose trips inspire you.')}</p>
							<span>{t('Meet travel agents')}</span>
						</Link>
						<Link href="/community" passHref>
							<AutoStoriesOutlinedIcon aria-hidden="true" />
							<h3>{t('See travel through another lens')}</h3>
							<p>{t('Read community stories, discover local tips, and join the conversation with other travelers.')}</p>
							<span>{t('Explore the stories')}</span>
						</Link>
					</div>
				</section>
				<section className="triplink-about__invitation" aria-labelledby="about-next-title">
					<div>
						<h2 id="about-next-title">{t('Where will your curiosity take you?')}</h2>
						<p>{t('Start with a destination, an experience, or a story that catches your eye.')}</p>
					</div>
					<Link href="/tour" className="triplink-about__button">
						{t('Find your next journey.')}
					</Link>
				</section>
				<div className="triplink-about__project-note">
					<p>{t('Payments are simulated. Chat history contains the latest 50 messages.')}</p>
					<Link href="/help-center">{t('Help Center')}</Link>
				</div>
			</div>
		</div>
	);
}
export default withLayoutBasic(About);
