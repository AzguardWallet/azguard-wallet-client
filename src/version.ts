import packageJson from "../package.json";

const [majorVersion, minorVersion] = packageJson.version.split(".");

export const isCompatible = (version: string) => {
    const [major, minor] = version.split(".");
    return major === majorVersion && minor === minorVersion;
};
