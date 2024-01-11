import { Fragment, useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useIntl } from "react-intl";
import classNames from "classnames";
import { Helmet } from "react-helmet-async";

import { getUnitMagicPoints } from "../../utils/points";
import { fetcher } from "../../utils/fetcher";
import { Header, Main } from "../../components/page";
import { setItems } from "../../state/items";
import { editUnit } from "../../state/lists";
import { useLanguage } from "../../utils/useLanguage";
import { updateList } from "../../utils/list";
import gameSystems from "../../assets/armies.json";

import { nameMap } from "./name-map";
import "./Magic.css";

let prevItemType, isFirstItemType;

const updateIds = (items) => {
  return items.map((item) => ({
    ...item,
    items: item.items.map((data, index) => {
      if (data.conditional) {
        return {
          ...data,
          id: index,
          conditional: data.conditional.map(
            (conditionalItem, conditionalIndex) => ({
              ...conditionalItem,
              id: `${index}-${conditionalIndex}`,
            })
          ),
        };
      }

      return {
        ...data,
        id: index,
      };
    }),
  }));
};

export const Magic = ({ isMobile }) => {
  const MainComponent = isMobile ? Main : Fragment;
  const location = useLocation();
  const { language } = useLanguage();
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(true);
  const { listId, type, unitId, command, group } = useParams();
  const dispatch = useDispatch();
  const list = useSelector((state) =>
    state.lists.find(({ id }) => listId === id)
  );
  const army =
    list &&
    gameSystems
      .find(({ id }) => id === list.game)
      .armies.find(({ id }) => list.army === id);
  const items = useSelector((state) => state.items);
  const units = list ? list[type] : null;
  const unit = units && units.find(({ id }) => id === unitId);
  let maxMagicPoints = 0;
  const handleMagicChange = (event, magicItem, isCommand) => {
    let magicItems;

    if (event.target.checked) {
      if (isCommand) {
        magicItems = [
          ...(unit.command[command].magic.selected || []),
          {
            ...magicItem,
            id: event.target.value,
          },
        ];
      } else {
        magicItems = [
          ...(unit.items[group].selected || []),
          {
            ...magicItem,
            id: event.target.value,
          },
        ];
      }
    } else {
      if (isCommand) {
        magicItems = unit.command[command].magic.selected.filter(
          ({ id }) => id !== event.target.value
        );
      } else {
        magicItems = unit.items[group].selected.filter(
          ({ id }) => id !== event.target.value
        );
      }
    }

    if (isCommand) {
      const newCommand = unit.command.map((entry, entryIndex) =>
        entryIndex === Number(command)
          ? {
              ...entry,
              magic: {
                ...entry.magic,
                selected: magicItems,
              },
            }
          : entry
      );

      dispatch(
        editUnit({
          listId,
          type,
          unitId,
          command: newCommand,
        })
      );
    } else {
      const newItems = unit.items.map((entry, entryIndex) =>
        entryIndex === Number(group)
          ? {
              ...entry,
              selected: magicItems,
            }
          : entry
      );

      dispatch(
        editUnit({
          listId,
          type,
          unitId,
          items: newItems,
        })
      );
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    list && updateList(list);
  }, [list]);

  useEffect(() => {
    army &&
      fetcher({
        url: `games/${list.game}/magic-items`,
        onSuccess: (data) => {
          const allItems = army.items.map((item) => {
            return {
              items: data[item],
              name_de: nameMap[item].name_de,
              name_en: nameMap[item].name_en,
              id: item,
            };
          });

          dispatch(setItems(updateIds(allItems)));
          setIsLoading(false);
        },
      });
  }, [army, dispatch, list, setIsLoading, unit, language]);

  if (isLoading) {
    if (isMobile) {
      return (
        <>
          <Header to={`/editor/${listId}/${type}/${unitId}`} />
          <Main loading />
        </>
      );
    } else {
      return (
        <>
          <Header to={`/editor/${listId}/${type}/${unitId}`} isSection />
          <Main loading />
        </>
      );
    }
  }

  const getCheckbox = ({ unit, magicItem, itemGroup, isConditional }) => {
    let isChecked = false;
    let isCommand = false;

    if (
      unit?.command &&
      unit.command[command] &&
      unit.command[command]?.magic?.maxPoints
    ) {
      isChecked =
        (unit.command[command].magic.selected || []).find(
          ({ id }) => id === `${itemGroup.id}-${magicItem.id}`
        ) || false;
      isCommand = true;
    } else if (unit?.items?.length) {
      isChecked =
        unit.items[group].selected.find(
          ({ id }) => id === `${itemGroup.id}-${magicItem.id}`
        ) || false;
    }

    return (
      <div
        className={classNames(
          "checkbox",
          isConditional && "checkbox--conditional"
        )}
        key={magicItem.id}
      >
        <input
          type="checkbox"
          id={`${itemGroup.id}-${magicItem.id}`}
          value={`${itemGroup.id}-${magicItem.id}`}
          onChange={(event) => handleMagicChange(event, magicItem, isCommand)}
          checked={isChecked}
          className="checkbox__input"
        />
        <label
          htmlFor={`${itemGroup.id}-${magicItem.id}`}
          className="checkbox__label"
        >
          {language === "de" ? magicItem.name_de : magicItem.name_en}
          <i className="checkbox__points">{`${
            magicItem.points
          } ${intl.formatMessage({
            id: "app.points",
          })}`}</i>
        </label>
      </div>
    );
  };

  let hasPointsError = false;
  let unitMagicPoints = 0;

  if (
    unit?.command &&
    unit.command[command] &&
    unit.command[command]?.magic?.maxPoints
  ) {
    maxMagicPoints = unit.command[command].magic.maxPoints;
    unitMagicPoints = getUnitMagicPoints({
      selected: unit.command[command].magic.selected,
    });
    hasPointsError = unitMagicPoints > maxMagicPoints;
  } else if (unit?.items?.length) {
    maxMagicPoints = unit.items[group].maxPoints;
    unitMagicPoints = getUnitMagicPoints({
      selected: unit.items[group].selected,
    });
    hasPointsError = unitMagicPoints > maxMagicPoints;
  }

  return (
    <>
      <Helmet>
        <title>{`Old World Builder | ${list?.name}`}</title>
      </Helmet>

      {isMobile && (
        <Header
          to={`/editor/${listId}/${type}/${unitId}`}
          headline={
            language === "de"
              ? unit?.items
                ? [group].name_de
                : intl.formatMessage({
                    id: "unit.magicItems",
                  })
              : unit?.items
              ? [group].name_en
              : intl.formatMessage({
                  id: "unit.magicItems",
                })
          }
          subheadline={
            <>
              <span
                className={classNames(
                  "magic__header-points",
                  hasPointsError && "magic__header-points--error"
                )}
              >
                {`${unitMagicPoints}`}&nbsp;
              </span>
              {`/ ${maxMagicPoints} ${intl.formatMessage({
                id: "app.points",
              })}`}
            </>
          }
          hasPointsError={hasPointsError}
        />
      )}

      <MainComponent>
        {!isMobile && (
          <Header
            isSection
            to={`/editor/${listId}/${type}/${unitId}`}
            headline={
              language === "de"
                ? unit?.items
                  ? [group].name_de
                  : intl.formatMessage({
                      id: "unit.magicItems",
                    })
                : unit?.items
                ? [group].name_en
                : intl.formatMessage({
                    id: "unit.magicItems",
                  })
            }
            subheadline={
              <>
                <span
                  className={classNames(
                    "magic__header-points",
                    hasPointsError && "magic__header-points--error"
                  )}
                >
                  {`${unitMagicPoints}`}&nbsp;
                </span>
                {`/ ${maxMagicPoints} ${intl.formatMessage({
                  id: "app.points",
                })}`}
              </>
            }
            hasPointsError={hasPointsError}
          />
        )}
        {items.map((itemGroup) => (
          <Fragment key={itemGroup.name_de}>
            <h2 className="unit__subline">
              {language === "de" ? itemGroup.name_de : itemGroup.name_en}
            </h2>
            {itemGroup.items.map((magicItem) => {
              if (prevItemType !== magicItem.type) {
                prevItemType = magicItem.type;
                isFirstItemType = true;
              } else {
                isFirstItemType = false;
              }

              // Filter command magic items
              if (
                unit?.command &&
                unit?.command[command] &&
                !unit.command[command].magic.types.includes(magicItem.type)
              ) {
                return null;
              }

              // Filter magic items
              if (
                unit?.items?.length &&
                !unit.items[group].types.includes(magicItem.type)
              ) {
                return null;
              }

              let isChecked = false;

              if (
                unit?.command &&
                unit.command[command] &&
                unit.command[command]?.magic?.maxPoints
              ) {
                isChecked =
                  (unit.command[command].magic.selected || []).find(
                    ({ id }) => id === `${itemGroup.id}-${magicItem.id}`
                  ) || false;
              } else if (unit?.items?.length) {
                isChecked =
                  unit.items[group].selected.find(
                    ({ id }) => id === `${itemGroup.id}-${magicItem.id}`
                  ) || false;
              }

              return (
                <Fragment key={magicItem.name_de}>
                  {isFirstItemType && (
                    <h3 className="magic__type">
                      {nameMap[magicItem.type][`name_${language}`]}
                    </h3>
                  )}
                  {getCheckbox({ unit, magicItem, itemGroup })}
                  {magicItem.conditional && isChecked
                    ? magicItem.conditional.map((conditionalItem) =>
                        getCheckbox({
                          unit,
                          magicItem: conditionalItem,
                          itemGroup,
                          isConditional: true,
                        })
                      )
                    : null}
                </Fragment>
              );
            })}
          </Fragment>
        ))}
      </MainComponent>
    </>
  );
};
