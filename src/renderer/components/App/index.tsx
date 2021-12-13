import { hot } from 'react-hot-loader';
import React, { useEffect, useState } from 'react';
import SimpleBar from 'simplebar-react';
import { Logo } from "renderer/components/Logo";
import SettingsSection from 'renderer/components/SettingsSection';
import DebugSection from 'renderer/components/DebugSection';
import AircraftSection from 'renderer/components/AircraftSection';

import { Container, MainLayout, PageHeader } from './styles';
import ChangelogModal from '../ChangelogModal';
import WarningModal from '../WarningModal';
import { GitVersions } from "@flybywiresim/api-client";
import { DataCache } from '../../utils/DataCache';
import * as actionTypes from '../../redux/actionTypes';
import store from '../../redux/store';
import { SetAddonAndTrackLatestReleaseInfo } from "renderer/redux/types";
import InstallerUpdate from "renderer/components/InstallerUpdate";
import { WindowButtons } from "renderer/components/WindowActionButtons";
import { Configuration, Addon, AddonVersion } from "renderer/utils/InstallerConfiguration";
import { AddonData } from "renderer/utils/AddonData";
import { ErrorModal } from '../ErrorModal';
import { NavBar, NavBarPublisher } from "renderer/components/App/NavBar";
import { Route, Switch, Redirect, useHistory } from 'react-router-dom';
import settings from 'common/settings';
import Snowfall from 'react-snowfall';

const releaseCache = new DataCache<AddonVersion[]>('releases', 1000 * 3600 * 24);

/**
 * Obtain releases for a specific addon
 *
 * @param addon
 */
export const getAddonReleases = async (addon: Addon): Promise<AddonVersion[]> => {
    const releases = (await releaseCache.fetchOrCompute(async (): Promise<AddonVersion[]> => {
        return (await GitVersions.getReleases(addon.repoOwner, addon.repoName))
            .filter(r => /v\d/.test(r.name))
            .map(r => ({ title: r.name, date: r.publishedAt, type: 'minor' }));
    })).map(r => ({ ...r, date: new Date(r.date) })); // Local Data cache returns a string instead of Date

    releases
        .forEach((version, index) => {
            const currentVersionTitle = version.title;
            const otherVersionTitle = index === releases.length - 1
                ? releases[index - 1].title
                : releases[index + 1].title;

            if (currentVersionTitle[1] !== otherVersionTitle[1]) {
                releases[index].type = 'major';
            } else if (currentVersionTitle[3] !== otherVersionTitle[3]) {
                releases[index].type = 'minor';
            } else if (currentVersionTitle[5] !== otherVersionTitle[5] && index === releases.length - 1) {
                releases[index].type = "minor";
            } else if (currentVersionTitle[5] !== otherVersionTitle[5]) {
                releases[index].type = 'patch';
            }
        });

    return releases;
};

export const fetchLatestVersionNames = async (addon: Addon): Promise<void> => {
    addon.tracks.forEach(async (track) => {
        const trackLatestVersionName = await AddonData.latestVersionForTrack(addon, track);

        store.dispatch<SetAddonAndTrackLatestReleaseInfo>({
            type: actionTypes.SET_ADDON_AND_TRACK_LATEST_RELEASE_INFO,
            payload: {
                addonKey: addon.key,
                trackKey: track.key,
                info: trackLatestVersionName,
            }
        });
    });
};

const App: React.FC<{ configuration: Configuration }> = ({ configuration }) => {
    const history = useHistory();

    const [addons] = useState<Addon[]>(
        configuration.publishers.reduce((arr, curr) => {
            arr.push(...curr.addons);
            return arr;
        }, [])
    );

    addons.forEach(AddonData.configureInitialAddonState);

    useEffect(() => {
        addons.forEach(fetchLatestVersionNames);
    }, []);

    const [selectedAddon, setSelectedAddon] = useState(addons[0]);
    const [selectedPublisher, setSelectedPublisher] = useState(configuration.publishers[0]);

    useEffect(() => {
        settings.set('cache.main.sectionToShow', history.location.pathname);
    }, [selectedAddon]);

    useEffect(() => {
        if (settings.get('cache.main.sectionToShow')) {
            history.push(settings.get('cache.main.sectionToShow'));
        }
    }, [selectedPublisher]);

    const [snowRate, setSnowRate] = useState(1000);

    useEffect(() => {
        setInterval(() => {
            setSnowRate(sr => {
                if (sr >= 60) {
                    console.log(sr);
                    return sr - 20;
                } else {
                    return sr;
                }
            });
        }, 250);
    }, []);

    return (
        <>
            <ErrorModal/>
            <ChangelogModal />
            <WarningModal />
            <SimpleBar>
                <Container className="flex flex-row">
                    <MainLayout className="flex flex-col overflow-hidden">
                        <div className="absolute w-full h-10 z-50 flex flex-row pl-4 items-center bg-navy-dark shadow-xl">
                            <PageHeader className="h-full flex-1 flex flex-row items-stretch">
                                <Logo />
                            </PageHeader>

                            <InstallerUpdate />
                            <WindowButtons />
                        </div>

                        <div className="h-full pt-10 flex flex-row justify-start">
                            <div className="z-50 flex flex-row">
                                <NavBar>
                                    {configuration.publishers.map((publisher) => (
                                        <NavBarPublisher
                                            selected={selectedPublisher === publisher}
                                            publisher={publisher}
                                            onClick={() => setSelectedPublisher(publisher)}
                                        />
                                    ))}
                                </NavBar>
                            </div>
                            <Snowfall
                                // Applied to the canvas element
                                style={{ position: 'absolute', inset: 0, zIndex: 100 }}
                                // Controls the number of snowflakes that are created (default 150)
                                snowflakeCount={snowRate}
                            />
                            <div className="bg-navy m-0 w-full">
                                <Switch>
                                    <Route exact path="/">
                                        <Redirect to="/aircraft-section"/>
                                    </Route>
                                    <Route path="/aircraft-section">
                                        <AircraftSection publisher={selectedPublisher} />;
                                    </Route>
                                    <Route path="/debug">
                                        <DebugSection/>
                                    </Route>
                                    <Route path="/settings">
                                        <SettingsSection/>
                                    </Route>
                                </Switch>
                            </div>
                        </div>
                    </MainLayout>
                </Container>
            </SimpleBar>
        </>
    );
};

export default hot(module)(App);
