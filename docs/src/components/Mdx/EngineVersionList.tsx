import dbVersionsList from '../../../../@generated/db-engine-versions/versions.json';
import { colors } from '../../styles/variables';

const EngineVersionListItem = ({ versionList, engineName }: { versionList: string[]; engineName: string }) => {
  return (
    <li>
      <p>
        <b>{engineName}</b>
      </p>
    </li>
  )
  // const [open, setOpen] = useState(false);
  // const oddRowColor = colors.darkerBackground;
  // const evenRowColor = colors.background;
  // const ref = useRef();
  // useCollapse(ref, open);

  // return (
  //   <li
  //     css={{ cursor: 'pointer', '&:hover': { backgroundColor: colors.elementBackgroundLighter } }}
  //     onClick={() => setOpen(!open)}
  //     aria-label={`${open ? 'collapse row' : 'expand row'}`}
  //   >
  //     <p>
  //       <b>{engineName}</b>
  //     </p>

  //     {(open ? versionList : versionList.slice(0, 3)).map((version) => (
  //       <p>
  //         <code>{version}</code>
  //       </p>
  //     ))}
  //     {/* {!open && <span>...</span>} */}
  //     <div
  //       css={{
  //         width: '30px',
  //         minWidth: '30px',
  //         //   display: 'flex',
  //         alignItems: 'center',
  //         paddingLeft: '8px',

  //         'svg path': {
  //           fill: colors.link
  //         },
  //         ...(open
  //           ? {
  //               transform: 'rotate(0deg)',
  //               WebkitTransition: 'transform 250ms ease-out',
  //               MozTransition: 'transform 250ms ease-out',
  //               OTransition: 'transform 250ms ease-out',
  //               transition: 'transform 250ms ease-out'
  //             }
  //           : {
  //               transform: 'rotate(180deg)',
  //               WebkitTransition: 'transform 250ms ease-out',
  //               MozTransition: 'transform 250ms ease-out',
  //               OTransition: 'transform 250ms ease-out',
  //               transition: 'transform 250ms ease-out'
  //             })
  //       }}
  //     >
  //       <OpenedSvg />
  //     </div>
  //   </li>
  // );
};

export function EngineVersionsList({ resourceType }: { resourceType: 'rds' }) {
  const enginesWithVersions = dbVersionsList[resourceType];

  return (
    <div
      css={{
        color: colors.fontColorPrimary,
        lineHeight: 1.75,
        fontSize: '15px',
        letterSpacing: '0.025em',
        // paddingLeft: '4px',
        paddingBottom: '6px'
      }}
    >
      <ul>
        {Object.entries(enginesWithVersions).map(([engineName, list]) =>
          <EngineVersionListItem key={engineName} versionList={list} engineName={engineName} />
        )}
      </ul>
    </div>
  );
};

